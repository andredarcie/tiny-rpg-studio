
import { ShareDecoder } from './ShareDecoder';
import { ShareEncoder } from './ShareEncoder';
import { ShareUrlHelper } from './ShareUrlHelper';
/**
 * ShareUtils delegates serialization and sharing to the specialized codecs.
 */
'use strict';

class ShareUtils {
    static buildShareUrl(gameData: Record<string, unknown> | null | undefined) {
        return ShareUrlHelper.buildShareUrl(gameData);
    }

    static extractGameDataFromLocation(location: { hash?: string } | null | undefined) {
        return ShareUrlHelper.extractGameDataFromLocation(location);
    }

    /**
     * Decode game data from a full share URL (e.g. a persisted/saved project URL),
     * reusing the same hash decoder as a live page location. Returns null when the
     * URL has no hash payload or fails to decode.
     */
    static extractGameDataFromShareUrl(shareUrl: string | null | undefined) {
        if (!shareUrl) return null;
        const hashIndex = shareUrl.indexOf('#');
        if (hashIndex < 0) return null;
        return ShareUrlHelper.extractGameDataFromLocation({ hash: shareUrl.slice(hashIndex) });
    }

    static encode(gameData: Record<string, unknown> | null | undefined) {
        return ShareEncoder.buildShareCode(gameData);
    }

    static decode(code: string | null | undefined) {
        return ShareDecoder.decodeShareCode(code);
    }
}

export { ShareUtils };
