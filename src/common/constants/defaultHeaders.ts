import { getRandomUserAgent } from './userAgents.js'

export const DEFAULT_HEADERS = {
    authority: 'na.web.skill.music.a2z.com',
    accept: '*/*',
    'accept-language': 'en-US,en;q=0.9',
    'content-type': 'text/plain;charset=UTF-8',
    origin: 'https://music.amazon.com',
    priority: 'u=1, i',
    referer: 'https://music.amazon.com/',
    'sec-ch-ua': '"Chromium";v="125", "Not.A/Brand";v="24"',
    'sec-ch-ua-mobile': '?1',
    'sec-ch-ua-platform': '"Android"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'cross-site',
    'user-agent': getRandomUserAgent()
}

export function buildAmazonHeaders(config: any, pageUrl = '') {
    return {
        'x-amzn-authentication': JSON.stringify({
            interface: 'ClientAuthenticationInterface.v1_0.ClientTokenElement',
            accessToken: config.accessToken || ''
        }),
        'x-amzn-device-model': 'WEBPLAYER',
        'x-amzn-device-width': '1920',
        'x-amzn-device-family': 'WebPlayer',
        'x-amzn-device-id': config.deviceId || '',
        'x-amzn-user-agent': getRandomUserAgent(),
        'x-amzn-session-id': config.sessionId || '',
        'x-amzn-device-height': '1080',
        'x-amzn-request-id': Math.random().toString(36).substring(2, 15),
        'x-amzn-device-language': 'en_US',
        'x-amzn-currency-of-preference': 'USD',
        'x-amzn-os-version': '1.0',
        'x-amzn-application-version': config.version || '',
        'x-amzn-device-time-zone': 'Asia/Calcutta',
        'x-amzn-timestamp': String(Date.now()),
        'x-amzn-csrf': JSON.stringify({
            interface: 'CSRFInterface.v1_0.CSRFHeaderElement',
            token: config.csrf && config.csrf.token ? config.csrf.token : '',
            timestamp: config.csrf && config.csrf.ts ? String(config.csrf.ts) : '',
            rndNonce: config.csrf && config.csrf.rnd ? String(config.csrf.rnd) : ''
        }),
        'x-amzn-music-domain': 'music.amazon.com',
        'x-amzn-referer': 'music.amazon.com',
        'x-amzn-affiliate-tags': '',
        'x-amzn-ref-marker': '',
        'x-amzn-page-url': pageUrl,
        'x-amzn-weblab-id-overrides': '',
        'x-amzn-video-player-token': '',
        'x-amzn-feature-flags': 'hd-supported,uhd-supported',
        'x-amzn-has-profile-id': '',
        'x-amzn-age-band': ''
    }
}
