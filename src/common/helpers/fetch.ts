import axios from 'axios'
import { FetchOptions } from '../../types/index.js'
import { ENDPOINTS, DEFAULT_HEADERS, buildAmazonHeaders } from '../constants/index.js'
import { getRandomUserAgent } from '../constants/userAgents.js'
import { createError } from '../../utils/createError.js'

interface CachedConfig<T> {
    data: T
    cookies: string
    fetchedAt: number
}

let cachedConfig: CachedConfig<any> | null = null
const CONFIG_TTL_MS = 5 * 60 * 1000 // 5 minutes

export const fetchConfig = async <T = any>(): Promise<T> => {
    const now = Date.now()
    if (cachedConfig && now - cachedConfig.fetchedAt < CONFIG_TTL_MS) {
        return cachedConfig.data as T
    }

    const response = await axios.post<T>(ENDPOINTS.CONFIG, '', {
        headers: {
            'content-type': 'text/plain;charset=UTF-8',
            accept: '*/*',
            'accept-language': 'en-US,en;q=0.9',
            'user-agent': getRandomUserAgent(),
            referer: 'https://music.amazon.com/',
            origin: 'https://music.amazon.com'
        },
        timeout: 5000
    })

    if (response.status !== 200 || !response.data) {
        throw createError(`Failed to fetch config`, response.status as any, 'FetchError')
    }

    const setCookieHeaders = response.headers['set-cookie']
    const cookies = Array.isArray(setCookieHeaders)
        ? setCookieHeaders.map((c: string) => c.split(';')[0]).join('; ')
        : typeof setCookieHeaders === 'string'
          ? (setCookieHeaders as string).split(';')[0]
          : ''

    const configData = response.data as any
    if (cookies) {
        configData._cookies = cookies
    }

    cachedConfig = {
        data: configData,
        cookies,
        fetchedAt: now
    }

    return configData as T
}

export const useFetch = async <T>({ url, body, pageUrl = '' }: FetchOptions): Promise<T> => {
    const uri = new URL(url)

    const config = await fetchConfig<any>()
    const cookies = config?._cookies || ''

    const httpHeaders = buildAmazonHeaders(config, pageUrl)

    const requestBody = body
        ? {
              ...body,
              headers: JSON.stringify(httpHeaders)
          }
        : {
              headers: JSON.stringify(httpHeaders)
          }

    const response = await axios.post(uri.toString(), requestBody, {
        headers: {
            ...DEFAULT_HEADERS,
            authority: uri.host,
            origin: 'https://music.amazon.com',
            referer: 'https://music.amazon.com/',
            ...(cookies ? { cookie: cookies } : {})
        },
        timeout: 10000
    })

    if (response.status !== 200) {
        const errorMessage = response.data?.message || 'Unknown error occurred'
        throw createError(`Failed to fetch data: ${errorMessage}`, response.status as any, 'FetchError')
    }

    return {
        success: true,
        status: response.status,
        body: requestBody,
        responseData: response.data,
        config: config
    } as unknown as T
}
