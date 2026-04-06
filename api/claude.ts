/**
 * Vercel serverless proxy for Anthropic API.
 * Injects the API key server-side so it never reaches the browser.
 */
export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured on server' }), { status: 500 })
  }

  // The client passes the original Anthropic path as a query param
  const url = new URL(req.url)
  const apiPath = url.searchParams.get('path') || '/v1/messages'
  const targetUrl = `https://api.anthropic.com${apiPath}`

  // Build headers for the upstream request
  const forwardHeaders: Record<string, string> = {
    'content-type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  }

  // Preserve anthropic-specific headers from the client
  for (const [key, value] of req.headers.entries()) {
    if (key.startsWith('anthropic-') && key !== 'anthropic-dangerous-direct-browser-access') {
      forwardHeaders[key] = value
    }
  }

  try {
    const body = await req.text()

    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: forwardHeaders,
      body,
    })

    // Stream the response back to the client
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
