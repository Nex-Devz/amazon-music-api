import { buildAmazonHeaders, DEFAULT_HEADERS } from '../../../common/constants/defaultHeaders.js'
import { ENDPOINTS } from '../../../common/constants/endpoints.js'
import { cleanImageUrl } from '../../../utils/cleanImageUrl.js'
import { createError } from '../../../utils/createError.js'
import { durationToSeconds } from '../../../utils/durationToSeconds.js'
import { SearchAlbum } from '../models/search-album.model.js'
import { SearchAll } from '../models/search-all.model.js'
import { SearchArtist } from '../models/search-artist.model.js'
import { SearchCommunityPl } from '../models/search-community-pl.model.js'
import { SearchPlaylist } from '../models/search-playlist.model.js'
import { SearchSong } from '../models/search-song.model.js'
import axios from 'axios'

interface WidgetItem {
    iconButton?: {
        observer?: {
            storageKey: string
        }
    }
    primaryText?: {
        text: string
        observer?: {
            defaultValue?: {
                text: string
            }
        }
    }
    primaryLink?: {
        deeplink: string
    }
    secondaryText?: string
    secondaryLink?: {
        deeplink: string
    }
    image?: string
    contextMenu?: {
        options?: Array<{
            onItemSelected?: any[]
        }>
    }
}

interface Widget {
    header?: string
    items: WidgetItem[]
}

export const createSearchAllPayload = async (config: any, resp: any): Promise<SearchAll> => {
    // Initialize the arrays that will be used
    const songs: SearchSong[] = []
    const albums: SearchAlbum[] = []
    const artists: SearchArtist[] = []
    const playlists: SearchPlaylist[] = []
    const communityPlaylists: SearchCommunityPl[] = []

    if (!resp?.methods?.[0]?.template?.widgets) {
        throw createError('Invalid response structure for global search', 500, 'InvalidResponseError')
    }

    // Get all widgets
    const widgets: Widget[] = resp.methods[0].template.widgets

    // Function to find widget by header
    const findWidgetByHeader = (headerText: string): Widget | undefined => {
        return widgets.find((widget: Widget) => widget.header?.toLowerCase().includes(headerText.toLowerCase()))
    }

    // Find specific widgets by their headers
    const songsWidget = findWidgetByHeader('songs')
    const artistsWidget = findWidgetByHeader('artists')
    const albumsWidget = findWidgetByHeader('albums')
    const playlistsWidget = findWidgetByHeader('playlists')
    const communityPlaylistsWidget = findWidgetByHeader('community playlists')

    // Process songs and push to songs array
    // if (songsWidget) {
    //     const songPromises = songsWidget.items.map(async (item: WidgetItem, _index: number) => {
    //         const storageKey = item.iconButton?.observer?.storageKey || ''
    //         const [albumId, songId] = storageKey.split(':')

    //         let duration = 0

    //         try {
    //             if (albumId && songId) {
    //                 const albumHeaders = buildAmazonHeaders(config, `https://music.amazon.com/albums/${albumId}`)

    //                 const body = {
    //                     id: albumId,
    //                     userHash: JSON.stringify({ level: 'LIBRARY_MEMBER' }),
    //                     headers: JSON.stringify(albumHeaders)
    //                 }

    //                 // Get album details for duration
    //                 const songAlbumData = await axios.post(ENDPOINTS.ALBUM_INFO, body, {
    //                     headers: DEFAULT_HEADERS,
    //                     timeout: 5000
    //                 })

    //                 // Find the specific track in album to get duration
    //                 if (
    //                     songAlbumData.data.methods[0].template.widgets &&
    //                     songAlbumData.data.methods[0].template.widgets[0]
    //                 ) {
    //                     const albumTracks = songAlbumData.data.methods[0].template.widgets[0].items
    //                     const albumTrack = albumTracks.find((track: any) => {
    //                         const trackDeeplink = track.primaryTextLink?.deeplink
    //                         if (trackDeeplink) {
    //                             const trackIdFromDeeplink = trackDeeplink.split('/tracks/')[1]?.split('/')[0]
    //                             return trackIdFromDeeplink === songId
    //                         }
    //                         return false
    //                     })

    //                     if (albumTrack) {
    //                         const durationString = albumTrack.secondaryText3 || ''
    //                         duration = durationToSeconds(durationString)
    //                     }
    //                 }
    //             }
    //         } catch (error) {
    //             console.log(`Could not fetch duration for song ${songId}`)
    //         }

    //         return {
    //             id: songId || '',
    //             title: item.primaryText?.text || 'Unknown Title',
    //             image: cleanImageUrl(item.image || null),
    //             url: songId ? `https://music.amazon.com/tracks/${songId}` : null,
    //             duration: duration,
    //             album: {
    //                 id: albumId || '',
    //                 name:
    //                     item.contextMenu?.options?.[0]?.onItemSelected?.[1]?.template?.headerText?.text ||
    //                     'Unknown Album',
    //                 url:
    //                     item.contextMenu?.options?.[0]?.onItemSelected?.[1]?.template?.templateData?.seoHead?.link?.[0]
    //                         ?.href || null
    //             },
    //             artist: {
    //                 id: item.secondaryLink?.deeplink
    //                     ? item.secondaryLink.deeplink.split('/artists/')[1]?.split('/')[0] || ''
    //                     : '',
    //                 name: item.secondaryText || 'Unknown Artist',
    //                 url: item.secondaryLink ? `https://music.amazon.com${item.secondaryLink.deeplink || ''}` : null
    //             }
    //         }
    //     })

    //     const songResults = await Promise.all(songPromises)
    //     songs.push(...songResults)
    // }

    // Process songs and push to songs array
    if (songsWidget) {
        const songItems: WidgetItem[] = songsWidget.items

        // ------------------------------
        // 1) Collect unique album IDs
        // ------------------------------
        const uniqueAlbums = new Set<string>()
        songItems.forEach((item) => {
            const storageKey = item.iconButton?.observer?.storageKey
            if (storageKey) {
                const [albumId] = storageKey.split(':')
                if (albumId) uniqueAlbums.add(albumId)
            }
        })

        const albumIds = Array.from(uniqueAlbums)

        // ------------------------------
        // 2) Album fetch cache
        // ------------------------------
        const albumDataCache = new Map()

        // ------------------------------
        // 3) Function to fetch album data
        // ------------------------------
        const fetchAlbumData = async (albumId: string) => {
            try {
                const albumHeaders = buildAmazonHeaders(config, `https://music.amazon.com/albums/${albumId}`)

                const body = {
                    id: albumId,
                    userHash: JSON.stringify({ level: 'LIBRARY_MEMBER' }),
                    headers: JSON.stringify(albumHeaders)
                }

                const result = await axios.post(ENDPOINTS.ALBUM_INFO, body, {
                    headers: {
                        ...DEFAULT_HEADERS,
                        authority: new URL(ENDPOINTS.ALBUM_INFO).host,
                        origin: 'https://music.amazon.com',
                        referer: 'https://music.amazon.com/',
                        ...(config?._cookies ? { cookie: config._cookies } : {})
                    },
                    timeout: 2000
                })

                return result.data
            } catch (err: any) {
                return null
            }
        }

        // ------------------------------
        // 4) Concurrent fetch albums
        // ------------------------------
        await Promise.allSettled(
            albumIds.map(async (id) => {
                const data = await fetchAlbumData(id)
                if (data) albumDataCache.set(id, data)
            })
        )

        // ------------------------------
        // 5) Process each song using cache
        // ------------------------------
        const songPromises = songItems.map(async (item: WidgetItem) => {
            const storageKey = item.iconButton?.observer?.storageKey || ''
            const [albumId, songId] = storageKey.split(':')

            let duration = 0

            if (albumId && songId) {
                const albumData = albumDataCache.get(albumId)

                if (albumData?.methods?.[0]?.template?.widgets?.[0]?.items) {
                    const tracks = albumData.methods[0].template.widgets[0].items

                    const albumTrack = tracks.find((track: any) => {
                        const link = track.primaryTextLink?.deeplink
                        if (!link) return false
                        const extractedId = link.split('/tracks/')[1]?.split('/')[0]
                        return extractedId === songId
                    })

                    if (albumTrack) {
                        const durationString = albumTrack.secondaryText3 || ''
                        duration = durationToSeconds(durationString)
                    }
                }
            }

            const viewAlbumOpt = item.contextMenu?.options?.find(
                (opt: any) => typeof opt?.text === 'string' && opt.text.toLowerCase().includes('album')
            )
            const albumTemplate = viewAlbumOpt?.onItemSelected?.[1]?.template
            const headerTextObj = albumTemplate?.headerText
            const extractedAlbumName = typeof headerTextObj === 'object' ? headerTextObj?.text : headerTextObj
            const extractedAlbumUrl =
                albumTemplate?.templateData?.seoHead?.link?.[0]?.href ||
                (albumId ? `https://music.amazon.com/albums/${albumId}` : null)

            const albumData = albumDataCache.get(albumId)
            const albumHeader = albumData?.methods?.[0]?.template?.headerText
            const albumNameFromData = typeof albumHeader === 'object' ? albumHeader?.text : albumHeader
            const albumName =
                extractedAlbumName ||
                albumNameFromData ||
                'Unknown Album'

            const songTitle =
                (typeof item.primaryText === 'object' ? item.primaryText?.text : item.primaryText) ||
                'Unknown Title'

            return {
                id: songId || '',
                title: songTitle,
                image: cleanImageUrl(item.image || null),
                url: songId ? `https://music.amazon.com/tracks/${songId}` : null,
                duration,
                isrc: null as string | null,

                album: {
                    id: albumId || '',
                    name: albumName,
                    url: extractedAlbumUrl
                },

                artist: {
                    id: item.secondaryLink?.deeplink
                        ? item.secondaryLink.deeplink.split('/artists/')[1]?.split('/')[0] || ''
                        : '',
                    name: item.secondaryText || 'Unknown Artist',
                    url: item.secondaryLink ? `https://music.amazon.com${item.secondaryLink.deeplink || ''}` : null
                }
            }
        })

        const songResults = await Promise.all(songPromises)
        songs.push(...songResults)
    }

    // Process albums and push to albums array
    if (albumsWidget) {
        albumsWidget.items.forEach((item: WidgetItem, _index: number) => {
            const albumId = item.primaryLink?.deeplink.split('/albums/')[1]?.split('/')[0]

            albums.push({
                id: albumId || '',
                name: item.primaryText?.text || 'Unknown Name',
                url: albumId ? `https://music.amazon.com/albums/${albumId}` : null,
                image: cleanImageUrl(item.image || null),
                artist: {
                    id: item.secondaryLink?.deeplink
                        ? item.secondaryLink.deeplink.split('/artists/')[1]?.split('/')[0] || ''
                        : '',
                    name: item.secondaryText || 'Unknown Artist',
                    url: item.secondaryLink ? `https://music.amazon.com${item.secondaryLink.deeplink || ''}` : null
                }
            })
        })
    }

    // Process artists and push to artists array
    if (artistsWidget) {
        artistsWidget.items.forEach((item: WidgetItem, _index: number) => {
            const id = item.primaryLink?.deeplink.split('/artists/')[1]?.split('/')[0] || null

            artists.push({
                id: id || '',
                name: item.primaryText?.text || 'Unknown Name',
                url: id ? `https://music.amazon.com${item.primaryLink?.deeplink}` : null,
                image: cleanImageUrl(item.image || null)
            })
        })
    }

    // Process playlists and push to playlists array
    if (playlistsWidget) {
        playlistsWidget.items.forEach((item: WidgetItem, _index: number) => {
            const id = item.primaryLink?.deeplink.split('/playlists/')[1]?.split('/')[0] || null

            playlists.push({
                id: id || '',
                name: item.primaryText?.observer?.defaultValue?.text || item.primaryText?.text || 'Unknown Name',
                url: id ? `https://music.amazon.com${item.primaryLink?.deeplink}` : null,
                image: cleanImageUrl(item.image || null),
                createdBy: `Amazon Music`
            })
        })
    }

    // Process community playlists and push to communityPlaylists array
    if (communityPlaylistsWidget) {
        communityPlaylistsWidget.items.forEach((item: WidgetItem, _index: number) => {
            const id = item.primaryLink?.deeplink.split('/user-playlists/')[1]?.split('/')[0] || null

            communityPlaylists.push({
                id: id || '',
                name: item.primaryText?.observer?.defaultValue?.text || item.primaryText?.text || 'Unknown Name',
                url: id ? `https://music.amazon.com${item.primaryLink?.deeplink}` : null,
                image: cleanImageUrl(item.image || null),
                createdBy: item.secondaryText || 'Unknown User'
            })
        })
    }

    return {
        songs: songs,
        albums: albums,
        artists: artists,
        playlists: playlists,
        communityPlaylists: communityPlaylists
    }
}
