import { cleanImageUrl } from '../../../utils/cleanImageUrl.js'
import { createError } from '../../../utils/createError.js'
import { durationToSeconds } from '../../../utils/durationToSeconds.js'
import { extractDurationFromText } from '../../../utils/extractDurationFromText.js'
import { extractSongsCountFromText } from '../../../utils/songsCountExtractor.js'
import { DetailsSong } from '../../songs/models/song.model.js'
import { DetailsPlaylist } from '../models/playlist.model.js'

// Helper to detect invalid/unavailable playlist responses
export function isInvalidPlaylistResponse(data: any): boolean {
    if (!data || !data.methods || data.methods.length === 0) return true

    const firstMethod = data.methods[0]
    const secondMethod = data.methods[1]

    // Service error dialog (e.g. unavailable in this region)
    const template = firstMethod?.template
    const iface = template?.interface
    if (
        iface?.includes('DialogTemplate') &&
        (template?.header === 'Service error' || template?.body?.text?.includes('went wrong'))
    ) {
        return true
    }

    // 1. First method template exists but widgets are empty → invalid playlist
    const widgets = template?.widgets
    if (Array.isArray(widgets) && widgets.length === 0) return true

    // 2. Check for playlist error notification in second method
    const notificationMessage =
        secondMethod?.notification?.message?.text || secondMethod?.notification?.message?.innerHTML || null

    if (notificationMessage && notificationMessage.toLowerCase().includes('playlist is no longer available')) {
        return true
    }

    // 3. Check for homepage deeplink redirect pattern
    const deeplink = template?.templateData?.deeplink
    if (deeplink === '/') return true

    return false
}

export const createPlaylistPayload = (data: any, playlistId: string): DetailsPlaylist => {
    if (isInvalidPlaylistResponse(data)) {
        throw createError('Invalid or unavailable playlist ID.', 404, 'PlaylistNotFound')
    }

    const playlist = data.methods[0].template

    let songs: DetailsSong[] = []
    if (playlist.widgets && playlist.widgets.length > 0 && Array.isArray(playlist.widgets[0].items)) {
        songs = playlist.widgets[0].items.map((item: any) => {
            const storageKey = item.iconButton?.observer?.storageKey || ''
            const [albumId, trackId] = storageKey.split(':')
            const artistId =
                item.secondaryText1Link?.deeplink?.split('/artists/')[1]?.split('/')[0] ||
                item.secondaryLink?.deeplink?.split('/artists/')[1]?.split('/')[0] ||
                null

            const songName =
                (typeof item.primaryText === 'object' ? item.primaryText?.text : item.primaryText) || null

            const artistUrl = item.secondaryText1Link?.deeplink
                ? `https://music.amazon.com${item.secondaryText1Link.deeplink}`
                : item.secondaryLink?.deeplink
                  ? `https://music.amazon.com${item.secondaryLink.deeplink}`
                  : null

            return {
                id: trackId || null,
                title: songName || 'Unknown Title',
                name: songName,
                url: trackId ? `https://music.amazon.com/tracks/${encodeURIComponent(trackId)}` : null,
                image: cleanImageUrl(item.image || null),
                duration: durationToSeconds(item.secondaryText3 || null),
                isrc: null,
                album: {
                    id: albumId || null,
                    name: item.secondaryText2 || null,
                    url: albumId ? `https://music.amazon.com/albums/${encodeURIComponent(albumId)}` : null
                },
                artist: {
                    id: artistId,
                    name: item.secondaryText1 || item.secondaryText || null,
                    url: artistUrl
                }
            }
        })
    }

    const playlistName =
        (typeof playlist.headerText === 'object' ? playlist.headerText?.text : playlist.headerText) ||
        playlist.headerPrimaryText ||
        playlist.headerLabel ||
        'Unknown Playlist'

    const info: DetailsPlaylist = {
        id: playlistId,
        name: playlistName,
        url: `https://music.amazon.com/playlists/${encodeURIComponent(playlistId)}`,
        image: playlist.headerImage || null,
        totalSongs: extractSongsCountFromText(playlist.headerTertiaryText || ''),
        totalDuration: extractDurationFromText(playlist.headerTertiaryText || ''),
        createdBy: 'Amazon Music',
        songs
    }

    return info
}
