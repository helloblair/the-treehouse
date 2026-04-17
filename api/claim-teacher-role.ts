/**
 * Server-side teacher role claim.
 *
 * The teacher access code lives only in `process.env.TEACHER_CODE` (no VITE_
 * prefix → never inlined into the browser bundle). This endpoint verifies the
 * caller's Supabase JWT, compares the submitted code in constant time, and —
 * on success — uses the service role key to set `user_profiles.role = 'teacher'`
 * for that uid. Direct client writes to the role column are blocked by the
 * column-level grants in 20260407_lock_role_column.sql.
 */
import { createClient } from '@supabase/supabase-js'

export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonError(405, 'Method not allowed')
  }

  const TEACHER_CODE = process.env.TEACHER_CODE
  // Vercel exposes VITE_-prefixed env vars to edge functions too, so we can
  // reuse the existing supabase URL without duplicating it.
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!TEACHER_CODE || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return jsonError(500, 'Server is not configured for teacher role claims')
  }

  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    return jsonError(401, 'Missing bearer token')
  }

  let body: { code?: unknown }
  try {
    body = (await req.json()) as { code?: unknown }
  } catch {
    return jsonError(400, 'Invalid JSON body')
  }

  const submittedCode = typeof body.code === 'string' ? body.code.trim() : ''
  if (!submittedCode) {
    return jsonError(400, 'Missing teacher code')
  }

  if (!constantTimeEquals(submittedCode, TEACHER_CODE)) {
    return jsonError(403, 'Invalid teacher code')
  }

  // Service-role client: bypasses RLS and column-level grants. Used for both
  // verifying the caller's JWT and performing the privileged role write.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData?.user) {
    return jsonError(401, 'Invalid or expired session')
  }

  const userId = userData.user.id

  const { error: updateErr } = await admin
    .from('user_profiles')
    .update({ role: 'teacher' })
    .eq('user_id', userId)

  if (updateErr) {
    console.error('[claim-teacher-role] update failed:', updateErr)
    return jsonError(500, 'Failed to update role')
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

// Constant-time string comparison so the response time doesn't leak how many
// characters of the teacher code an attacker has guessed correctly.
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}
