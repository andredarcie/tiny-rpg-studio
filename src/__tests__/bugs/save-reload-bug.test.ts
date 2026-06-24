import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectSaveManager } from '../../editor/manager/ProjectSaveManager';
import { ShareUtils } from '../../runtime/infra/share/ShareUtils';
import { ShareEncoder } from '../../runtime/infra/share/ShareEncoder';

/**
 * Failing-by-design regression test for the user-reported bug:
 *   "Saving a game and then reloading the page RESETS it back to the default
 *    Tiny RPG Studio data."
 *
 * Root cause: the editor "Save" persists the project into localStorage
 * (ProjectSaveManager), but the boot path only restores a game from the URL
 * hash / inline code — it never consults localStorage. So a plain reload with
 * no hash loads the default game and the user's work appears lost.
 *
 * These tests exercise the EXACT restore path the boot uses
 * (ProjectSaveManager.getMostRecentShareUrl + ShareUtils.extractGameDataFromShareUrl).
 * They FAIL until those helpers exist and the boot wires them in.
 */
describe('BUG #5: save + reload must not reset to the default game', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('restores the most recently saved project after a reload with no URL hash', () => {
        // Arrange — the user saves a game with a custom title/author.
        const gameData = { title: 'My Saved World', author: 'Andre' };
        const code = ShareEncoder.buildShareCode(gameData);
        const shareUrl = `https://andredarcie.github.io/tiny-rpg-studio/#${code}`;
        const psm = new ProjectSaveManager();
        psm.manualSave(shareUrl, 'My Saved World');

        // Act — simulate the boot restore path (no location hash present).
        const restoredUrl = ProjectSaveManager.getMostRecentShareUrl();
        const restored = restoredUrl ? ShareUtils.extractGameDataFromShareUrl(restoredUrl) : null;

        // Assert — the saved game comes back, NOT the default Studio data.
        expect(restoredUrl).toBe(shareUrl);
        expect(restored).toBeTruthy();
        expect((restored as { title?: string } | null)?.title).toBe('My Saved World');
    });

    it('returns null when there is no saved project (fresh visitor → default game)', () => {
        expect(ProjectSaveManager.getMostRecentShareUrl()).toBeNull();
    });

    it('ignores a corrupted localStorage payload instead of throwing', () => {
        localStorage.setItem('tiny-rpg-projects-history', '{ not valid json');
        expect(() => ProjectSaveManager.getMostRecentShareUrl()).not.toThrow();
        expect(ProjectSaveManager.getMostRecentShareUrl()).toBeNull();
    });
});
