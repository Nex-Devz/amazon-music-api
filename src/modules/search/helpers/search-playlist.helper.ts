import { cleanImageUrl } from '../../../utils/cleanImageUrl.js'
import { createError } from '../../../utils/createError.js'
import { SearchPlaylist } from '../models/search-playlist.model.js'

interface WidgetItem {
    iconButton?: {
        observer?: {
            storageKey: string
        }
    }
    primaryText?: {
        observer?: {
            defaultValue?: {
                text: string
            }
        }
        text?: string
    }
    image?: string
}

interface PaginationWidgetItem {
    iconButton?: {
        observer?: {
            storageKey: string
        }
    }
    primaryText?: {
        observer?: {
            defaultValue?: {
                text: string
            }
        }
        text?: string
    }
    image?: string
}

export const createSearchPlaylistPayload = (resp: any): SearchPlaylist[] => {
    const playlists: SearchPlaylist[] = []

    let playlistItems: WidgetItem[] = []
    const widgets = resp?.methods?.[0]?.template?.widgets
    if (Array.isArray(widgets)) {
        for (const widget of widgets) {
            if (Array.isArray(widget.items)) {
                playlistItems.push(...widget.items)
            }
        }
    } else if (Array.isArray(resp?.methods?.[0]?.items)) {
        playlistItems.push(...resp.methods[0].items)
    }

    if (playlistItems.length === 0) {
        throw createError('No playlists found for the given search query', 404, 'NoPlaylistsFound')
    }

    // Extract next token for pagination
    let nextTokenForPagination = null
    if (
        resp.methods?.[0]?.template?.widgets &&
        resp.methods[0].template.widgets[0]?.onEndOfWidget &&
        resp.methods[0].template.widgets[0].onEndOfWidget[0]
    ) {
        const onEndOfWidgetUrl = resp.methods[0].template.widgets[0].onEndOfWidget[0].url
        if (onEndOfWidgetUrl) {
            const urlParams = new URLSearchParams(onEndOfWidgetUrl.split('?')[1])
            nextTokenForPagination = urlParams.get('next')
        }
    }

    const items = playlistItems
        .map((item: WidgetItem) => {
            const playlistId = item.iconButton?.observer?.storageKey || null

            if (!playlistId) return null

            const playlistName =
                (typeof item.primaryText === 'object'
                    ? (item.primaryText as any)?.observer?.defaultValue?.text || (item.primaryText as any)?.text
                    : item.primaryText) || 'Unknown Playlist'

            return {
                id: playlistId,
                name: playlistName,
                url: playlistId ? `https://music.amazon.com/playlists/${playlistId}` : null,
                image: cleanImageUrl(item.image || null),
                createdBy: 'Amazon Music'
            }
        })
        .filter((item): item is SearchPlaylist => item !== null)

    if (items.length === 0) {
        throw createError('No playlists found for the given search query', 404, 'NoPlaylistsFound')
    }

    // Push all valid items to the playlists array
    playlists.push(...items)

    return playlists
}

export const createSearchPlaylistPagePayload = (resp: any): SearchPlaylist[] => {
    const playlists: SearchPlaylist[] = []

    let playlistItems: PaginationWidgetItem[] = []
    if (Array.isArray(resp?.methods?.[0]?.items)) {
        playlistItems = resp.methods[0].items
    } else if (Array.isArray(resp?.methods?.[0]?.template?.widgets)) {
        for (const widget of resp.methods[0].template.widgets) {
            if (Array.isArray(widget.items)) {
                playlistItems.push(...widget.items)
            }
        }
    }

    if (playlistItems.length === 0) {
        throw createError('No playlists found for the given search query', 404, 'NoPlaylistsFound')
    }

    // Extract next token for pagination
    let nextTokenForPagination = null
    if (resp.methods?.[0]?.onEndOfWidget && resp.methods[0].onEndOfWidget[0]) {
        const onEndOfWidgetUrl = resp.methods[0].onEndOfWidget[0].url
        if (onEndOfWidgetUrl) {
            const urlParams = new URLSearchParams(onEndOfWidgetUrl.split('?')[1])
            nextTokenForPagination = urlParams.get('next')
        }
    }

    const items = playlistItems
        .map((item: PaginationWidgetItem) => {
            const playlistId = item.iconButton?.observer?.storageKey || null

            if (!playlistId) return null

            const playlistName =
                (typeof item.primaryText === 'object'
                    ? (item.primaryText as any)?.observer?.defaultValue?.text || (item.primaryText as any)?.text
                    : item.primaryText) || 'Unknown Playlist'

            return {
                id: playlistId,
                name: playlistName,
                url: playlistId ? `https://music.amazon.com/playlists/${playlistId}` : null,
                image: cleanImageUrl(item.image || null),
                createdBy: 'Amazon Music'
            }
        })
        .filter((item): item is SearchPlaylist => item !== null)

    if (items.length === 0) {
        throw createError('No playlists found for the given search query', 404, 'NoPlaylistsFound')
    }

    // Push all valid items to the playlists array
    playlists.push(...items)

    return playlists
}
