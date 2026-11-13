import { createError } from "../../../utils/createError.js";
import { durationToSeconds } from "../../../utils/durationToSeconds.js";
import { DetailsSong } from "../models/song.model.js"


// Helper function to detect invalid track responses
function isInvalidTrackResponse(data: any) {
  // Check if this is the generic homepage response (invalid track)
  if (!data.methods || !data.methods.length) return true;

  const firstMethod = data.methods[0];

  // Check for the "We're sorry" notification in methods
  const hasErrorNotification = data.methods.some(
    (method: any) =>
      method.interface ===
        "Web.TemplatesInterface.v1_0.Touch.ChromeTemplateInterface.ShowNotificationMethod" &&
      method.notification?.message?.text?.includes(
        "this track is no longer available"
      )
  );

  // Check if the template is a gallery template with empty widgets (homepage)
  const isHomepageTemplate =
    firstMethod.template?.interface?.includes("GalleryTemplate") &&
    Array.isArray(firstMethod.template.widgets) &&
    firstMethod.template.widgets.length === 0;

  return hasErrorNotification || isHomepageTemplate;
}

export const createSongPayload = (resp :any, trackId: string): DetailsSong => {
   // Check if this is an invalid track response
    if (isInvalidTrackResponse(resp)) {
      throw createError(
        "Track not found or no longer available",
        404,
        "TrackNotFound"
      );
    }  
  
  const firstMethod = resp.methods[0];

    if (!firstMethod.template) {
      throw createError("Invalid response structure", 404, "TrackNotFound");
    }

    const template = firstMethod.template;
    const widgets = template.widgets || [];

    // Find album tracklist widget
    const albumTracklistWidget = widgets.find((widget: any) =>
      widget.header?.toLowerCase().includes("album tracklist")
    );

    if (!albumTracklistWidget || !albumTracklistWidget.items) {
      throw createError(
        "Track not found in album tracklist",
        404,
        "TrackNotFound"
      );
    }

    const trackTitle =
      (typeof template.headerText === "object"
        ? template.headerText?.text
        : template.headerText) || "Unknown Title";

    // Find the specific track in the tracklist by ID, or by title matching
    let trackItem = albumTracklistWidget?.items?.find((item: any) => {
      if (!item?.primaryTextLink?.deeplink) return false;
      const id = item.primaryTextLink.deeplink
        .split("/tracks/")[1]
        ?.split("/")[0]
        ?.split("?")[0];
      return id === trackId;
    });

    if (!trackItem && trackTitle && albumTracklistWidget?.items) {
      trackItem = albumTracklistWidget.items.find((item: any) => {
        const itemTitle =
          typeof item.primaryText === "object"
            ? item.primaryText?.text
            : item.primaryText;
        return (
          itemTitle && itemTitle.toLowerCase() === trackTitle.toLowerCase()
        );
      });
    }

    // Safely extract album info
    let albumId = null;
    let albumName = null;
    let albumUrl = null;

    const albumOption =
        template.contextMenu?.options?.[1]?.onItemSelected?.[1]?.template;
      if (albumOption) {
        albumId =
          albumOption.templateData?.deeplink?.split("/albums/")[1] || null;
        albumName = albumOption.headerText?.text || null;
        albumUrl = albumOption.templateData?.seoHead?.link?.[0]?.href || null;
      }

    // Safely extract artist info
    let artistId = null;
    let artistName = template.headerPrimaryText || null;
    let artistUrl = null;

    if (template.headerPrimaryTextLink?.deeplink) {
        const artistPath =
          template.headerPrimaryTextLink.deeplink.split("/artists/")[1];
        artistId = artistPath ? artistPath.split("/")[0] : null;
        artistUrl = `https://music.amazon.com${template.headerPrimaryTextLink.deeplink}`;
      }

    // Extract ISRC from templateData SEO JSON-LD script
    let isrc: string | null = null;
    try {
      const seoScripts = template.templateData?.seoHead?.script;
      if (seoScripts && Array.isArray(seoScripts)) {
        for (const script of seoScripts) {
          if (script.innerHTML) {
            const jsonLd = JSON.parse(script.innerHTML);
            if (jsonLd.isrcCode) {
              isrc = jsonLd.isrcCode;
              break;
            }
          }
        }
      }
    } catch {
      // ISRC extraction failed, continue with null
    }

    const info: DetailsSong & { name?: string } = {
      id: trackId,
      title: trackTitle,
      name: trackTitle,
      url: `https://music.amazon.com/tracks/${trackId}`,
      image: template.headerImage || null,
      duration: trackItem
        ? durationToSeconds(trackItem.secondaryText3 || "")
        : 0,
      isrc,
      album: {
        id: albumId,
        name: albumName,
        url: albumUrl,
      },
      artist: {
        id: artistId,
        name: artistName,
        url: artistUrl,
      },
    };

    return info;
} 