
import { ShareDecoder } from './ShareDecoder';
import { ShareEncoder } from './ShareEncoder';
import { ShareUrlHelper } from './ShareUrlHelper';
/**
 * ShareUtils delegates serialization and sharing to the specialized codecs.
 */
'use strict';

class ShareUtils {
    static buildShareUrl(gameData: Record<string, unknown> | null | undefined) {
        if (ShareUtils.needsFullProject(gameData)) return '';
        return ShareUrlHelper.buildShareUrl(gameData);
    }

    static needsFullProject(gameData: Record<string, unknown> | null | undefined): boolean {
        const world = gameData?.world as { rows?: number; cols?: number } | undefined;
        return Boolean((gameData?.gameplayPlugins as unknown[] | undefined)?.length || (gameData?.soundsPlus && Object.keys(gameData.soundsPlus).length) || (world && (world.rows !== undefined || world.cols !== undefined) && (world.rows !== 3 || world.cols !== 3)));
    }

    static buildStoredProject(gameData: Record<string, unknown> | null | undefined): string {
        if (!gameData) return '';
        return ShareUtils.needsFullProject(gameData) ? `snapshot:${JSON.stringify(gameData)}` : ShareUtils.buildShareUrl(gameData);
    }

    static readStoredProject(value: string | null | undefined): Record<string, unknown> | null {
        if (!value) return null;
        if (value.startsWith('snapshot:')) {
            try { return JSON.parse(value.slice(9)) as Record<string, unknown>; }
            catch { return null; }
        }
        return ShareUtils.extractGameDataFromShareUrl(value);
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
        if (ShareUtils.needsFullProject(gameData)) return '';
        return ShareEncoder.buildShareCode(gameData);
    }

    static decode(code: string | null | undefined) {
        return ShareDecoder.decodeShareCode(code);
    }
}

export { ShareUtils };
