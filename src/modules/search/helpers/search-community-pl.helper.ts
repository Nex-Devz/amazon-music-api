import { cleanImageUrl } from '../../../utils/cleanImageUrl.js'
import { createError } from '../../../utils/createError.js'
import { SearchCommunityPl } from '../models/search-community-pl.model.js'

interface WidgetItem {
    primaryText?: {
        observer?: {
            storageKey?: string
            defaultValue?: {
                text: string
            }
        }
    }
    secondaryText?: string
    image?: string
}

interface PaginationWidgetItem {
    primaryText?: {
        observer?: {
            storageKey?: string
            defaultValue?: {
                text: string
            }
        }
    }
    secondaryText?: string
    image?: string
}

export const createSearchCommunityPlaylistPayload = (resp: any): SearchCommunityPl[] => {
    const communityPlaylists: SearchCommunityPl[] = []

    let communityPlaylistItems: WidgetItem[] = []
    const widgets = resp?.methods?.[0]?.template?.widgets
    if (Array.isArray(widgets)) {
        for (const widget of widgets) {
            if (Array.isArray(widget.items)) {
                communityPlaylistItems.push(...widget.items)
            }
        }
    } else if (Array.isArray(resp?.methods?.[0]?.items)) {
        communityPlaylistItems.push(...resp.methods[0].items)
    }

    if (communityPlaylistItems.length === 0) {
        throw createError('No community playlists found for the given keyword', 404, 'NoCommunityPlaylistsFound')
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

    const items = communityPlaylistItems
        .map((item: WidgetItem) => {
            const id = item.primaryText?.observer?.storageKey || null

            if (!id) return null

            const name =
                item.primaryText?.observer?.defaultValue?.text ||
                (typeof item.primaryText === 'object' ? (item.primaryText as any)?.text : item.primaryText) ||
                'Unknown Community Playlist'

            return {
                id: id,
                name,
                url: id ? `https://music.amazon.com/user-playlists/${id}` : null,
                image: cleanImageUrl(item.image || null),
                createdBy: item.secondaryText || 'Amazon Music Community'
            }
        })
        .filter((item): item is SearchCommunityPl => item !== null)

    if (items.length === 0) {
        throw createError('No community playlists found for the given keyword', 404, 'NoCommunityPlaylistsFound')
    }

    // Push all valid items to the communityPlaylists array
    communityPlaylists.push(...items)

    return communityPlaylists
}

export const createSearchCommunityPlaylistPagePayload = (resp: any): SearchCommunityPl[] => {
    const communityPlaylists: SearchCommunityPl[] = []

    let communityPlaylistItems: PaginationWidgetItem[] = []
    if (Array.isArray(resp?.methods?.[0]?.items)) {
        communityPlaylistItems = resp.methods[0].items
    } else if (Array.isArray(resp?.methods?.[0]?.template?.widgets)) {
        for (const widget of resp.methods[0].template.widgets) {
            if (Array.isArray(widget.items)) {
                communityPlaylistItems.push(...widget.items)
            }
        }
    }

    if (communityPlaylistItems.length === 0) {
        throw createError(
            'No community playlists found for the given keyword on this page',
            404,
            'NoCommunityPlaylistsFound'
        )
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

    const items = communityPlaylistItems
        .map((item: PaginationWidgetItem) => {
            const id = item.primaryText?.observer?.storageKey || null

            if (!id) return null

            const name =
                item.primaryText?.observer?.defaultValue?.text ||
                (typeof item.primaryText === 'object' ? (item.primaryText as any)?.text : item.primaryText) ||
                'Unknown Community Playlist'

            return {
                id: id,
                name,
                url: id ? `https://music.amazon.com/user-playlists/${id}` : null,
                image: cleanImageUrl(item.image || null),
                createdBy: item.secondaryText || 'Amazon Music Community'
            }
        })
        .filter((item): item is SearchCommunityPl => item !== null)

    if (items.length === 0) {
        throw createError(
            'No community playlists found for the given keyword on this page',
            404,
            'NoCommunityPlaylistsFound'
        )
    }

    // Push all valid items to the communityPlaylists array
    communityPlaylists.push(...items)

    return communityPlaylists
}
