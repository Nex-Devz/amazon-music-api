import { SearchAlbum } from '../models/search-album.model.js'
import { cleanImageUrl } from '../../../utils/cleanImageUrl.js'
import { createError } from '../../../utils/createError.js'

interface WidgetItem {
    iconButton?: {
        observer?: {
            storageKey: string
        }
    }
    primaryText?: {
        text: string
    }
    primaryLink?: {
        deeplink: string
    }
    secondaryText?: string
    secondaryLink?: {
        deeplink: string
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
    secondaryText?: string
    secondaryLink?: {
        deeplink: string
    }
    image?: string
}

export const createSearchAlbumPayload = (resp: any): SearchAlbum[] => {
    const albums: SearchAlbum[] = []

    let albumItems: WidgetItem[] = []
    const widgets = resp?.methods?.[0]?.template?.widgets
    if (Array.isArray(widgets)) {
        for (const widget of widgets) {
            if (Array.isArray(widget.items)) {
                albumItems.push(...widget.items)
            }
        }
    } else if (Array.isArray(resp?.methods?.[0]?.items)) {
        albumItems.push(...resp.methods[0].items)
    }

    if (albumItems.length === 0) {
        throw createError('No albums found for the given search query', 404, 'NoAlbumsFound')
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

    const items = albumItems
        .map((item: WidgetItem) => {
            // Extract album ID from storageKey or primaryLink
            const albumId =
                item.iconButton?.observer?.storageKey ||
                item.primaryLink?.deeplink?.split('/albums/')[1]?.split('/')[0] ||
                null

            if (!albumId) return null

            // Extract artist ID from secondaryLink
            const artistId = item.secondaryLink?.deeplink?.split('/artists/')[1]?.split('/')[0] || null

            const albumName =
                (typeof item.primaryText === 'object' ? (item.primaryText as any)?.text : item.primaryText) ||
                'Unknown Album'

            return {
                id: albumId,
                name: albumName,
                url: albumId ? `https://music.amazon.com/albums/${albumId}` : null,
                image: cleanImageUrl(item.image || null),
                artist: {
                    id: artistId,
                    name: item.secondaryText || 'Unknown Artist',
                    url: item.secondaryLink ? `https://music.amazon.com${item.secondaryLink.deeplink || ''}` : null
                }
            }
        })
        .filter((item): item is SearchAlbum => item !== null)

    if (items.length === 0) {
        throw createError('No albums found for the given search query', 404, 'NoAlbumsFound')
    }

    // Push all valid items to the albums array
    albums.push(...items)

    return albums
}

export const createSearchAlbumPagePayload = (resp: any): SearchAlbum[] => {
    const albums: SearchAlbum[] = []

    let albumItems: PaginationWidgetItem[] = []
    if (Array.isArray(resp?.methods?.[0]?.items)) {
        albumItems = resp.methods[0].items
    } else if (Array.isArray(resp?.methods?.[0]?.template?.widgets)) {
        for (const widget of resp.methods[0].template.widgets) {
            if (Array.isArray(widget.items)) {
                albumItems.push(...widget.items)
            }
        }
    }

    if (albumItems.length === 0) {
        throw createError('No albums found for the given search query on this page', 404, 'NoAlbumsFound')
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

    const items = albumItems
        .map((item: PaginationWidgetItem) => {
            const albumId = item.iconButton?.observer?.storageKey || null

            if (!albumId) return null

            // Extract artist ID from secondaryLink
            const artistId = item.secondaryLink?.deeplink?.split('/artists/')[1]?.split('/')[0] || null

            const albumName =
                (typeof item.primaryText === 'object' ? (item.primaryText as any)?.text : item.primaryText) ||
                'Unknown Album'

            return {
                id: albumId,
                name: albumName,
                url: albumId ? `https://music.amazon.com/albums/${albumId}` : null,
                image: cleanImageUrl(item.image || null),
                artist: {
                    id: artistId,
                    name: item.secondaryText || 'Unknown Artist',
                    url: item.secondaryLink ? `https://music.amazon.com${item.secondaryLink.deeplink || ''}` : null
                }
            }
        })
        .filter((item): item is SearchAlbum => item !== null)

    if (items.length === 0) {
        throw createError('No albums found for the given search query on this page', 404, 'NoAlbumsFound')
    }

    // Push all valid items to the albums array
    albums.push(...items)

    return albums
}
