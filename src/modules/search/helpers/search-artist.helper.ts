import { cleanImageUrl } from '../../../utils/cleanImageUrl.js'
import { createError } from '../../../utils/createError.js'
import { SearchArtist } from '../models/search-artist.model.js'

interface WidgetItem {
    iconButton?: {
        observer?: {
            storageKey: string
        }
    }
    primaryText?: {
        text: string
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
        text: string
    }
    image?: string
}

export const createSearchArtistPayload = (resp: any): SearchArtist[] => {
    const artists: SearchArtist[] = []

    let artistItems: WidgetItem[] = []
    const widgets = resp?.methods?.[0]?.template?.widgets
    if (Array.isArray(widgets)) {
        for (const widget of widgets) {
            if (Array.isArray(widget.items)) {
                artistItems.push(...widget.items)
            }
        }
    } else if (Array.isArray(resp?.methods?.[0]?.items)) {
        artistItems.push(...resp.methods[0].items)
    }

    if (artistItems.length === 0) {
        throw createError('No artists found for the given search query', 404, 'NoArtistsFound')
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

    const items = artistItems
        .map((item: WidgetItem) => {
            const artistId = item.iconButton?.observer?.storageKey || null

            if (!artistId) return null

            const artistName =
                (typeof item.primaryText === 'object' ? (item.primaryText as any)?.text : item.primaryText) ||
                'Unknown Artist'

            return {
                id: artistId,
                name: artistName,
                url: artistId ? `https://music.amazon.com/artists/${artistId}` : null,
                image: cleanImageUrl(item.image || null)
            }
        })
        .filter((item): item is SearchArtist => item !== null)

    if (items.length === 0) {
        throw createError('No artists found for the given search query', 404, 'NoArtistsFound')
    }

    // Push all valid items to the artists array
    artists.push(...items)

    return artists
}

export const createSearchArtistPagePayload = (resp: any): SearchArtist[] => {
    const artists: SearchArtist[] = []

    let artistItems: PaginationWidgetItem[] = []
    if (Array.isArray(resp?.methods?.[0]?.items)) {
        artistItems = resp.methods[0].items
    } else if (Array.isArray(resp?.methods?.[0]?.template?.widgets)) {
        for (const widget of resp.methods[0].template.widgets) {
            if (Array.isArray(widget.items)) {
                artistItems.push(...widget.items)
            }
        }
    }

    if (artistItems.length === 0) {
        throw createError('No artists found for the given search query and page', 404, 'NoArtistsFound')
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

    const items = artistItems
        .map((item: PaginationWidgetItem) => {
            const artistId = item.iconButton?.observer?.storageKey || null

            if (!artistId) return null

            const artistName =
                (typeof item.primaryText === 'object' ? (item.primaryText as any)?.text : item.primaryText) ||
                'Unknown Artist'

            return {
                id: artistId,
                name: artistName,
                url: artistId ? `https://music.amazon.com/artists/${artistId}` : null,
                image: cleanImageUrl(item.image || null)
            }
        })
        .filter((item): item is SearchArtist => item !== null)

    if (items.length === 0) {
        throw createError('No artists found for the given search query and page', 404, 'NoArtistsFound')
    }

    // Push all valid items to the artists array
    artists.push(...items)

    return artists
}
