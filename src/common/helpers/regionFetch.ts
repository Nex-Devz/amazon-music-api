// Shared multi-region fetch utilities.
// Provides per-domain config.json fetching with caching, a generic regional endpoint fetcher,
// and a multi-region resolution function used by playlists, albums, and other modules.

import axios from 'axios'
import { RegionConfig, REGION_CONFIG_MAP, getRegionConfig } from '../constants/regionConfig.js'
import { DEFAULT_HEADERS, buildAmazonHeaders } from '../constants/defaultHeaders.js'
import { getRandomUserAgent } from '../constants/userAgents.js'
import { createError } from '../../utils/createError.js'

// All domains for concurrent fallback — each territory has its own musicTerritory/marketplace
const ALL_DOMAINS: { domain: string; config: RegionConfig }[] = Object.entries(REGION_CONFIG_MAP).map(
    ([domain, config]) => ({ domain, config })
)

// Per-domain config cache: stores fetched config.json with a TTL and cookies
const CONFIG_CACHE = new Map<string, { data: Record<string, unknown>; cookies: string; fetchedAt: number }>()
const CONFIG_TTL_MS = 5 * 60 * 1000 // 5 minutes

/** Fetch config.json from a specific Amazon Music domain, with caching */
export async function fetchDomainConfig(domain: string): Promise<{ data: Record<string, unknown>; cookies: string }> {
    const now = Date.now()
    const cached = CONFIG_CACHE.get(domain)
    if (cached && now - cached.fetchedAt < CONFIG_TTL_MS) {
        return { data: cached.data, cookies: cached.cookies }
    }

    const configUrl = `https://${domain}/config.json?skipToken=false&clientApplication=skyfire`
    const response = await axios.post(configUrl, '', {
        headers: {
            'content-type': 'text/plain;charset=UTF-8',
            accept: '*/*',
            'accept-language': 'en-US,en;q=0.9',
            'user-agent': getRandomUserAgent(),
            referer: `https://${domain}/`,
            origin: `https://${domain}`,
            'sec-ch-ua': '"Chromium";v="125", "Not.A/Brand";v="24"',
            'sec-ch-ua-mobile': '?1',
            'sec-ch-ua-platform': '"Android"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin'
        },
        timeout: 5000
    })

    if (response.status !== 200 || !response.data) {
        throw new Error(`Failed to fetch config from ${domain}: HTTP ${response.status}`)
    }

    const setCookieHeaders = response.headers['set-cookie']
    const cookies = Array.isArray(setCookieHeaders)
        ? setCookieHeaders.map((c: string) => c.split(';')[0]).join('; ')
        : typeof setCookieHeaders === 'string'
          ? (setCookieHeaders as string).split(';')[0]
          : ''

    const data = response.data as Record<string, unknown>
    CONFIG_CACHE.set(domain, { data, cookies, fetchedAt: now })
    return { data, cookies }
}

export interface RegionFetchResult {
    responseData: Record<string, unknown>
    domain: string
}

export interface RegionFetchOptions {
    /** The resource ID (playlist ID, album ID, etc.) */
    id: string
    /** The API path on the skill endpoint, e.g. '/api/showCatalogPlaylist' */
    apiPath: string
    /** The URL path segment for the page URL, e.g. 'playlists', 'albums' */
    urlPathSegment: string
    /** Entity name for error messages, e.g. 'Playlist', 'Album' */
    entityName: string
    /** Optional domain hint extracted from a URL */
    domainHint?: string
    /** Function to check if the response is an error/unavailable */
    isErrorResponse: (data: Record<string, unknown>) => boolean
}

/** Fetch a resource from a single regional skill endpoint using domain-specific config */
async function fetchFromEndpoint(
    id: string,
    apiPath: string,
    urlPathSegment: string,
    regionCfg: RegionConfig,
    domain: string
): Promise<Record<string, unknown>> {
    const { data: domainConfig, cookies } = await fetchDomainConfig(domain)

    const url = `${regionCfg.skillEndpoint}${apiPath}`

    const innerHeaders = buildAmazonHeaders(
        domainConfig,
        `https://${domain}/${urlPathSegment}/${encodeURIComponent(id)}`
    )
    innerHeaders['x-amzn-device-language'] = regionCfg.language
    innerHeaders['x-amzn-currency-of-preference'] = regionCfg.currency
    innerHeaders['x-amzn-device-family'] = regionCfg.deviceFamily
    innerHeaders['x-amzn-music-domain'] = domain
    innerHeaders['x-amzn-referer'] = domain
    innerHeaders['x-amzn-feature-flags'] = regionCfg.featureFlags

    const requestBody = {
        id,
        userHash: JSON.stringify({ level: 'LIBRARY_MEMBER' }),
        headers: JSON.stringify(innerHeaders)
    }

    const outerHeaders = {
        ...DEFAULT_HEADERS,
        authority: new URL(regionCfg.skillEndpoint).host,
        origin: `https://${domain}`,
        referer: `https://${domain}/`,
        'user-agent': getRandomUserAgent(),
        ...(cookies ? { cookie: cookies } : {})
    }

    const response = await axios.post(url, requestBody, {
        headers: outerHeaders,
        timeout: 8000
    })

    if (response.status !== 200 || !response.data) {
        throw new Error(`HTTP ${response.status}`)
    }

    return response.data as Record<string, unknown>
}

/**
 * Fetch a resource with automatic multi-region resolution.
 *
 * - If `domainHint` is provided (extracted from a URL), tries that region's endpoint first.
 * - If the hint fails or no hint is given, concurrently fetches from all domains
 *   and returns the first valid response via Promise.any.
 */
export async function fetchMultiRegion(options: RegionFetchOptions): Promise<RegionFetchResult> {
    const { id, apiPath, urlPathSegment, entityName, domainHint, isErrorResponse } = options

    // If we have a domain hint, try the targeted endpoint first
    if (domainHint) {
        const regionCfg = getRegionConfig(domainHint)
        if (regionCfg) {
            try {
                const data = await fetchFromEndpoint(id, apiPath, urlPathSegment, regionCfg, domainHint)
                if (!isErrorResponse(data)) {
                    return { responseData: data, domain: domainHint }
                }
            } catch {
                // Targeted fetch failed — fall through to concurrent fetch
            }
        }
    }

    // Concurrent fetch from all domains — first valid response wins
    try {
        return await Promise.any(
            ALL_DOMAINS.map(async ({ domain, config }) => {
                const data = await fetchFromEndpoint(id, apiPath, urlPathSegment, config, domain)
                if (isErrorResponse(data)) {
                    throw new Error(`${entityName} not available on ${domain}`)
                }
                return { responseData: data, domain } satisfies RegionFetchResult
            })
        )
    } catch {
        throw createError(`${entityName} not found on any regional endpoint (NA, EU, FE)`, 404, `${entityName}NotFound`)
    }
}
