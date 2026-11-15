import axios from 'axios'
import { buildAmazonHeaders, DEFAULT_HEADERS } from '../../../common/constants/defaultHeaders.js'
import { cleanImageUrl } from '../../../utils/cleanImageUrl.js'
import { createError } from '../../../utils/createError.js'
import { durationToSeconds } from '../../../utils/durationToSeconds.js'
import { SearchSong } from '../models/search-song.model.js'
import { ENDPOINTS } from '../../../common/constants/endpoints.js'

interface WidgetItem {
    iconButton?: {
        observer?: {
            storageKey: string
        }
    }
    primaryText?: {
        text: string
    } | string
    secondaryText?: string
    secondaryText1?: string
    secondaryText2?: string
    secondaryText3?: string
    secondaryLink?: {
        deeplink: string
    }
    secondaryText1Link?: {
        deeplink: string
    }
    image?: string
    contextMenu?: {
        options?: Array<{
            onItemSelected?: any[]
        }>
    }
}

interface PaginationWidgetItem {
    iconButton?: {
        observer?: {
            storageKey: string
        }
    }
    primaryText?: {
        text: string
    } | string
    secondaryText?: string
    secondaryText1?: string
    secondaryText2?: string
    secondaryText3?: string
    secondaryLink?: {
        deeplink: string
    }
    secondaryText1Link?: {
        deeplink: string
    }
    image?: string
    contextMenu?: {
        options?: Array<{
            onItemSelected?: any[]
        }>
    }
}

export const createSearchSongsPayload = async (config: any, resp: any, limit?: number): Promise<SearchSong[]> => {
    const songs: SearchSong[] = []

    let songItems: WidgetItem[] = []
    const widgets = resp?.methods?.[0]?.template?.widgets
    if (Array.isArray(widgets)) {
        for (const widget of widgets) {
            if (Array.isArray(widget.items)) {
                songItems.push(...widget.items)
            }
        }
    } else if (Array.isArray(resp?.methods?.[0]?.items)) {
        songItems.push(...resp.methods[0].items)
    }

    if (songItems.length === 0) {
        throw createError('No songs found for the given search query', 404, 'NoSongsError')
    }

    // Apply limit early to only process requested number of songs
    if (limit && limit > 0) {
        songItems = songItems.slice(0, limit)
    }

    // Request-level cache
    const albumDataCache = new Map()

    // Function to fetch album data
    const fetchAlbumData = async (albumId: string): Promise<any> => {
        try {
            const albumHeaders = buildAmazonHeaders(config, `https://music.amazon.com/albums/${albumId}`)

            const body = {
                id: albumId,
                userHash: JSON.stringify({ level: 'LIBRARY_MEMBER' }),
                headers: JSON.stringify(albumHeaders)
            }

            const songAlbumData = await axios.post(ENDPOINTS.ALBUM_INFO, body, {
                headers: {
                    ...DEFAULT_HEADERS,
                    authority: new URL(ENDPOINTS.ALBUM_INFO).host,
                    origin: 'https://music.amazon.com',
                    referer: 'https://music.amazon.com/',
                    ...(config?._cookies ? { cookie: config._cookies } : {})
                },
                timeout: 2500
            })

            return songAlbumData.data
        } catch (error: any) {
            return null
        }
    }

    // Collect unique album IDs (only from limited songs)
    const uniqueAlbums = new Set()
    songItems.forEach((item) => {
        const storageKey = item.iconButton?.observer?.storageKey
        if (storageKey) {
            const [albumId] = storageKey.split(':')
            if (albumId) {
                uniqueAlbums.add(albumId)
            }
        }
    })

    const albumIds = Array.from(uniqueAlbums)

    // Fetch unique albums concurrently with 2.5s timeout
    await Promise.allSettled(
        albumIds.map(async (albumId) => {
            const data = await fetchAlbumData(albumId as string)
            if (data) albumDataCache.set(albumId, data)
        })
    )

    // Process all songs with the fetched album data
    const items = songItems.map((item: WidgetItem) => {
        try {
            const storageKey = item.iconButton?.observer?.storageKey
            if (!storageKey) return null

            const [albumId, songId] = storageKey.split(':')
            if (!songId) return null

            let duration = 0
            const artistId =
                item.secondaryLink?.deeplink?.split('/artists/')[1]?.split('/')[0] ||
                item.secondaryText1Link?.deeplink?.split('/artists/')[1]?.split('/')[0] ||
                ''
            const artistName = item.secondaryText || item.secondaryText1 || 'Unknown Artist'

            // Use cached album data to find duration
            const albumData = albumDataCache.get(albumId)
            if (albumData?.methods?.[0]?.template?.widgets?.[0]) {
                const albumTracks = albumData.methods[0].template.widgets[0].items
                const albumTrack = albumTracks.find((track: any) => {
                    const trackDeeplink = track.primaryTextLink?.deeplink
                    if (trackDeeplink) {
                        const trackIdFromDeeplink = trackDeeplink.split('/tracks/')[1]?.split('/')[0]
                        return trackIdFromDeeplink === songId
                    }
                    return false
                })

                if (albumTrack) {
                    const durationString = albumTrack.secondaryText3 || ''
                    duration = durationToSeconds(durationString)
                }
            }

            const artistUrl = item.secondaryLink?.deeplink
                ? `https://music.amazon.com${item.secondaryLink.deeplink}`
                : item.secondaryText1Link?.deeplink
                  ? `https://music.amazon.com${item.secondaryText1Link.deeplink}`
                  : null

            const viewAlbumOpt = item.contextMenu?.options?.find(
                (opt: any) => typeof opt?.text === 'string' && opt.text.toLowerCase().includes('album')
            )
            const albumTemplate = viewAlbumOpt?.onItemSelected?.[1]?.template
            const headerTextObj = albumTemplate?.headerText
            const extractedAlbumName = typeof headerTextObj === 'object' ? headerTextObj?.text : headerTextObj
            const extractedAlbumUrl =
                albumTemplate?.templateData?.seoHead?.link?.[0]?.href ||
                (albumId ? `https://music.amazon.com/albums/${albumId}` : null)

            const songTitle =
                (typeof item.primaryText === 'object' ? item.primaryText?.text : item.primaryText) ||
                'Unknown Title'

            const albumHeader = albumData?.methods?.[0]?.template?.headerText
            const albumNameFromData = typeof albumHeader === 'object' ? albumHeader?.text : albumHeader
            const albumName =
                extractedAlbumName ||
                albumNameFromData ||
                item.secondaryText2 ||
                'Unknown Album'

            const albumUrl = extractedAlbumUrl || (albumId ? `https://music.amazon.com/albums/${albumId}` : null)

            return {
                id: songId,
                title: songTitle,
                url: songId ? `https://music.amazon.com/tracks/${songId}` : null,
                image: cleanImageUrl(item.image || null),
                duration: duration,
                isrc: null as string | null,
                artist: {
                    id: artistId,
                    name: artistName,
                    url: artistUrl
                },
                album: {
                    id: albumId,
                    name: albumName,
                    url: albumUrl
                }
            }
        } catch (itemError) {
            console.log(`Error processing song item`)
            return null
        }
    })

    const validItems = items.filter((item): item is SearchSong => item !== null)

    if (validItems.length === 0) {
        throw createError('No songs found for the given search query', 404, 'NoSongsError')
    }

    songs.push(...validItems)

    return songs
}

export const createSearchSongsPagePayload = async (config: any, resp: any, limit?: number): Promise<SearchSong[]> => {
    const songs: SearchSong[] = []

    let songItems: PaginationWidgetItem[] = []
    if (Array.isArray(resp?.methods?.[0]?.items)) {
        songItems = resp.methods[0].items
    } else if (Array.isArray(resp?.methods?.[0]?.template?.widgets)) {
        for (const widget of resp.methods[0].template.widgets) {
            if (Array.isArray(widget.items)) {
                songItems.push(...widget.items)
            }
        }
    }

    if (songItems.length === 0) {
        throw createError('No songs found for the given search query', 404, 'NoSongsError')
    }

    // Apply limit early to only process requested number of songs
    if (limit && limit > 0) {
        songItems = songItems.slice(0, limit)
    }

    // ⬇ Extract next pagination token (same as before but untouched)
    let nextTokenForPagination = null
    if (resp.methods?.[0]?.onEndOfWidget && resp.methods[0].onEndOfWidget[0]) {
        const onEndOfWidgetUrl = resp.methods[0].onEndOfWidget[0].url
        if (onEndOfWidgetUrl) {
            const urlParams = new URLSearchParams(onEndOfWidgetUrl.split('?')[1])
            nextTokenForPagination = urlParams.get('next')
        }
    }

    // -----------------------------------------
    // 1) CACHE + UNIQUE ALBUM IDS EXTRACTION (from limited songs)
    // -----------------------------------------
    const albumDataCache = new Map()
    const uniqueAlbums = new Set()

    songItems.forEach((item) => {
        const storageKey = item.iconButton?.observer?.storageKey
        if (storageKey) {
            const [albumId] = storageKey.split(':')
            if (albumId) uniqueAlbums.add(albumId)
        }
    })

    const albumIds = Array.from(uniqueAlbums)

    // -----------------------------------------
    // 2) FUNCTION TO FETCH ALBUM DATA
    // -----------------------------------------
    const fetchAlbumData = async (albumId: string): Promise<any> => {
        try {
            const headers = buildAmazonHeaders(config, `https://music.amazon.com/albums/${albumId}`)

            const body = {
                id: albumId,
                userHash: JSON.stringify({ level: 'LIBRARY_MEMBER' }),
                headers: JSON.stringify(headers)
            }

            const res = await axios.post(ENDPOINTS.ALBUM_INFO, body, {
                headers: {
                    ...DEFAULT_HEADERS,
                    authority: new URL(ENDPOINTS.ALBUM_INFO).host,
                    origin: 'https://music.amazon.com',
                    referer: 'https://music.amazon.com/',
                    ...(config?._cookies ? { cookie: config._cookies } : {})
                },
                timeout: 2500
            })

            return res.data
        } catch (err: any) {
            return null
        }
    }

    // -----------------------------------------
    // 3) CONCURRENT FETCH ALBUMS
    // -----------------------------------------
    await Promise.allSettled(
        albumIds.map(async (albumId) => {
            const data = await fetchAlbumData(albumId as string)
            if (data) albumDataCache.set(albumId, data)
        })
    )

    // -----------------------------------------
    // 4) PROCESS SONG ITEMS USING CACHE
    // -----------------------------------------
    const items = await Promise.all(
        songItems.map(async (item: PaginationWidgetItem) => {
            try {
                const storageKey = item.iconButton?.observer?.storageKey
                if (!storageKey) return null

                const [albumId, trackId] = storageKey.split(':')
                if (!trackId) return null

                let duration = 0

                const artistId =
                    item.secondaryLink?.deeplink?.split('/artists/')[1]?.split('/')[0] ||
                    item.secondaryText1Link?.deeplink?.split('/artists/')[1]?.split('/')[0] ||
                    ''
                const artistName = item.secondaryText || item.secondaryText1 || 'Unknown Artist'

                // ⬇ Use CACHE not API
                const albumData = albumDataCache.get(albumId)

                if (albumData?.methods?.[0]?.template?.widgets?.[0]) {
                    const albumTracks = albumData.methods[0].template.widgets[0].items

                    const albumTrack = albumTracks.find((track: any) => {
                        const trackDeeplink = track.primaryTextLink?.deeplink
                        if (trackDeeplink) {
                            const idFromLink = trackDeeplink.split('/tracks/')[1]?.split('/')[0]
                            return idFromLink === trackId
                        }
                        return false
                    })

                    if (albumTrack) {
                        const durationString = albumTrack.secondaryText3 || ''
                        duration = durationToSeconds(durationString)
                    }
                }

                const artistUrl = item.secondaryLink?.deeplink
                    ? `https://music.amazon.com${item.secondaryLink.deeplink}`
                    : item.secondaryText1Link?.deeplink
                      ? `https://music.amazon.com${item.secondaryText1Link.deeplink}`
                      : null

                const viewAlbumOpt = item.contextMenu?.options?.find(
                    (opt: any) => typeof opt?.text === 'string' && opt.text.toLowerCase().includes('album')
                )
                const albumTemplate = viewAlbumOpt?.onItemSelected?.[1]?.template
                const headerTextObj = albumTemplate?.headerText
                const extractedAlbumName = typeof headerTextObj === 'object' ? headerTextObj?.text : headerTextObj
                const extractedAlbumUrl =
                    albumTemplate?.templateData?.seoHead?.link?.[0]?.href ||
                    (albumId ? `https://music.amazon.com/albums/${albumId}` : null)

                const albumHeader = albumData?.methods?.[0]?.template?.headerText
                const albumNameFromData = typeof albumHeader === 'object' ? albumHeader?.text : albumHeader
                const albumName =
                    extractedAlbumName ||
                    albumNameFromData ||
                    item.secondaryText2 ||
                    'Unknown Album'

                const albumUrl = extractedAlbumUrl || (albumId ? `https://music.amazon.com/albums/${albumId}` : null)

                const songTitle =
                    (typeof item.primaryText === 'object' ? item.primaryText?.text : item.primaryText) ||
                    'Unknown Title'

                return {
                    id: trackId,
                    title: songTitle,
                    url: trackId ? `https://music.amazon.com/tracks/${trackId}` : null,
                    image: cleanImageUrl(item.image || null),
                    duration,
                    isrc: null as string | null,
                    artist: {
                        id: artistId,
                        name: artistName,
                        url: artistUrl
                    },
                    album: {
                        id: albumId,
                        name: albumName,
                        url: albumUrl
                    }
                }
            } catch (err) {
                console.log(`Error processing song item`)
                return null
            }
        })
    )

    const validItems = items.filter((item): item is SearchSong => item !== null)

    if (validItems.length === 0) {
        throw createError('No songs found for the given search query', 404, 'NoSongsError')
    }

    songs.push(...validItems)

    return songs
}
