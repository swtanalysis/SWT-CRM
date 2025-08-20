import { NextRequest, NextResponse } from 'next/server'

const AMADEUS_AUTH_URL = 'https://test.api.amadeus.com/v1/security/oauth2/token'
const AMADEUS_SEARCH_URL = 'https://test.api.amadeus.com/v1/reference-data/locations'

let tokenCache: { accessToken: string; expiresAt: number } | null = null

async function getAmadeusToken() {
  const clientId = process.env.AMADEUS_CLIENT_ID
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Missing AMADEUS_CLIENT_ID/AMADEUS_CLIENT_SECRET env vars')
  }
  const now = Date.now()
  if (tokenCache && tokenCache.expiresAt > now + 5000) return tokenCache.accessToken

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  })
  const res = await fetch(AMADEUS_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store'
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Amadeus token error: ${res.status} ${text}`)
  }
  const data = await res.json() as { access_token: string; expires_in: number }
  tokenCache = { accessToken: data.access_token, expiresAt: now + data.expires_in * 1000 }
  return tokenCache.accessToken
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() || ''
  if (!q || q.length < 2) return NextResponse.json([], { status: 200 })

  try {
    const token = await getAmadeusToken()
    const url = new URL(AMADEUS_SEARCH_URL)
    url.searchParams.set('subType', 'AIRPORT,CITY')
    url.searchParams.set('keyword', q)
    url.searchParams.set('view', 'FULL')
    url.searchParams.set('page[limit]', '10')

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    })
    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `Upstream error: ${res.status} ${text}` }, { status: 502 })
    }
    const json = await res.json() as any
    const items = Array.isArray(json.data) ? json.data : []
    // Map to simplified shape and de-duplicate by IATA code
    const seen = new Set<string>()
    const out = [] as Array<{ code: string; name: string; city?: string; country?: string; type: string }>
    for (const it of items) {
      const code = it.iataCode || it.address?.iataCode
      if (!code || seen.has(code)) continue
      seen.add(code)
      out.push({
        code,
        name: it.name || it.detailedName || code,
        city: it.address?.cityName || it.address?.cityNameLocalized || it.address?.cityCode,
        country: it.address?.countryName,
        type: it.subType || it.type,
      })
    }
    return NextResponse.json(out)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
