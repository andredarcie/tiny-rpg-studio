
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

    static encode(gameData: Record<string, unknown> | null | undefined) {
        return ShareEncoder.buildShareCode(gameData);
    }

    static decode(code: string | null | undefined) {
        return ShareDecoder.decodeShareCode(code);
    }
}

export { ShareUtils };
