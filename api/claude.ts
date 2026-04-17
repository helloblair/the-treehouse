/**
 * Vercel serverless proxy for Anthropic API.
 *
 * - Injects ANTHROPIC_API_KEY server-side so it never reaches the browser.
 * - Verifies the caller's Supabase JWT (sent in x-treehouse-auth) so random
 *   visitors on the public deployment can't burn the platform's Anthropic
 *   credits. Without this, /api/claude is a wide-open relay.
 */
import { createClient } from '@supabase/supabase-js'

export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonError(405, 'Method not allowed')
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return jsonError(500, 'ANTHROPIC_API_KEY not configured on server')
  }

  // ── Auth gate: require a valid Supabase JWT ──
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!SUPABASE_URL || !ANON_KEY) {
    return jsonError(500, 'Supabase is not configured on server')
  }

  const treehouseAuth = req.headers.get('x-treehouse-auth') || ''
  const token = treehouseAuth.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    return jsonError(401, 'Missing Treehouse auth token')
  }

  // The anon key is sufficient for getUser(token) — Supabase verifies the JWT
  // signature against the project's signing key. We do not need the
  // service-role key on this path.
  const supa = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: authErr } = await supa.auth.getUser(token)
  if (authErr || !userData?.user) {
    return jsonError(401, 'Invalid or expired session')
  }

  // ── Forward to Anthropic ──
  const url = new URL(req.url)
  const apiPath = url.searchParams.get('path') || '/v1/messages'
  const targetUrl = `https://api.anthropic.com${apiPath}`

  const forwardHeaders: Record<string, string> = {
    'content-type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  }

  // Preserve anthropic-specific headers from the client
  req.headers.forEach((value, key) => {
    if (key.startsWith('anthropic-') && key !== 'anthropic-dangerous-direct-browser-access') {
      forwardHeaders[key] = value
    }
  })

  try {
    const body = await req.text()

    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: forwardHeaders,
      body,
    })

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'application/json',
      },
    })
  } catch (err: any) {
    console.error('Claude proxy error:', err)
    return new Response(
      JSON.stringify({ error: 'Failed to reach Anthropic API', details: err.message }),
      { status: 502 }
    )
  }
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
