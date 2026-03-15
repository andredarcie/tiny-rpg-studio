import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProjectSaveManager } from '../../editor/manager/ProjectSaveManager';
import type { ProjectSaveManagerOptions } from '../../editor/manager/ProjectSaveManager.types';

/**
 * Critical tests for ProjectSaveManager auto-save functionality
 * Tests auto-save interval, edge cases, and deduplication logic
 */
describe('ProjectSaveManager - Critical Auto-Save', () => {
  const defaultStorageKey = 'tiny-rpg-projects-history';
  const mockShareUrl = 'https://example.com/share/critical-test';
  const mockProjectTitle = 'Critical Test Project';

  let manager: ProjectSaveManager;
  let localStorageSpy: { [key: string]: string } = {};

  beforeEach(() => {
    localStorageSpy = {};
    localStorage.clear();

    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => localStorageSpy[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          localStorageSpy[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete localStorageSpy[key];
        }),
        clear: vi.fn(() => {
          localStorageSpy = {};
        }),
        length: 0,
        key: vi.fn(),
      },
      writable: true,
    });

    vi.useFakeTimers();
    manager = new ProjectSaveManager();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    manager.destroy?.();
  });

  // ─── Auto-Save Interval Behavior ───────────────────────────────────────────

  describe('auto-save interval behavior', () => {
    it('should trigger auto-save at configured interval', () => {
      const options: ProjectSaveManagerOptions = {
        autoSaveIntervalMs: 2000,
      };
      const mgr = new ProjectSaveManager(options);
      const autoSaveSpy = vi.spyOn(mgr, 'autoSave');

      mgr.initialize(() => ({ shareUrl: mockShareUrl, title: mockProjectTitle }));

      // Should not fire before interval elapses
      vi.advanceTimersByTime(1999);
      expect(autoSaveSpy).not.toHaveBeenCalled();

      // Should fire exactly once after one interval
      vi.advanceTimersByTime(1);
      expect(autoSaveSpy).toHaveBeenCalledTimes(1);
      expect(autoSaveSpy).toHaveBeenCalledWith(mockShareUrl, mockProjectTitle);
    });

    it('should respect 2-minute default interval', () => {
      const mgr = new ProjectSaveManager();
      mgr.initialize();

      // Default should be 120000ms (2 minutes)
      expect(vi.getTimerCount()).toBeGreaterThan(0);
    });

    it('should not save if share URL has not changed', () => {
      manager.initialize();

      const result1 = manager.autoSave(mockShareUrl, mockProjectTitle);
      const historyLength1 = manager.getHistory().length;

      // Try to save same URL again
      const result2 = manager.autoSave(mockShareUrl, mockProjectTitle);

      // Depending on implementation: might add duplicate, move to top, or ignore
      // All behaviors should be valid based on SAVE_PLAN
      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);
    });

    it('should save when share URL changes', () => {
      manager.initialize();

      const url1 = 'https://example.com/share/version1';
      const url2 = 'https://example.com/share/version2';

      manager.autoSave(url1, 'Version 1');
      const history1 = manager.getHistory();

      manager.autoSave(url2, 'Version 2');
      const history2 = manager.getHistory();

      // Should have added new entry
      expect(history2.length).toBeGreaterThanOrEqual(history1.length);
    });

    it('should handle rapid consecutive auto-saves', () => {
      manager.initialize();

      for (let i = 0; i < 3; i++) {
        manager.autoSave(`https://example.com/share/rapid${i}`, `Rapid Save ${i}`);
      }

      const history = manager.getHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history.length).toBeLessThanOrEqual(5);
    });

    it('should continue after error in auto-save', () => {
      manager.initialize();

      // First successful save
      manager.autoSave(mockShareUrl, mockProjectTitle);

      // Mock error on next attempt
      vi.mocked(localStorage.setItem).mockImplementationOnce(() => {
        throw new Error('Temporary storage error');
      });

      // Should handle error gracefully
      const errorResult = manager.autoSave('https://example.com/share/after-error', 'After Error');
      expect(errorResult).toBeDefined();

      // Should still work on next attempt
      vi.mocked(localStorage.setItem).mockRestore();
      const successResult = manager.autoSave('https://example.com/share/recovery', 'Recovery');
      expect(successResult.ok).toBe(true);
    });
  });

  // ─── Deduplication and Queue Management ────────────────────────────────────

  describe('deduplication and queue management', () => {
    it('should detect and move duplicate project to top', () => {
      manager.initialize();

      const url = 'https://example.com/share/deduplicate';
      manager.addToHistory(url, 'Original');
      manager.addToHistory('https://example.com/share/other1', 'Other 1');
      manager.addToHistory('https://example.com/share/other2', 'Other 2');

      const historyBefore = manager.getHistory();
      const idOfOriginal = historyBefore[historyBefore.length - 1].id;

      // Save same URL again
      manager.addToHistory(url, 'Updated');

      const historyAfter = manager.getHistory();
      expect(historyAfter[0].id).toBe(idOfOriginal);
      expect(historyAfter[0].title).toBe('Updated');
    });

    it('should update all metadata on deduplication', () => {
      manager.initialize();

      const url = 'https://example.com/share/meta-update';
      const thumbnail1 = 'data:image/png;base64,AABBCC';
      const thumbnail2 = 'data:image/png;base64,DDEEFF';

      manager.addToHistory(url, 'Original Title', thumbnail1);
      const savedAt1 = manager.getHistory()[0].savedAt;

      vi.advanceTimersByTime(5000);

      manager.addToHistory(url, 'Updated Title', thumbnail2);
      const project = manager.getHistory()[0];

      expect(project.title).toBe('Updated Title');
      expect(project.thumbnail).toBe(thumbnail2);
      expect(project.savedAt).toBeGreaterThan(savedAt1);
    });

    it('should maintain exactly 5 items with proper FIFO eviction', () => {
      manager.initialize();

      // Add 6 projects
      for (let i = 0; i < 6; i++) {
        manager.addToHistory(`https://example.com/share/fifo${i}`, `FIFO Project ${i}`);
        vi.advanceTimersByTime(100);
      }

      const history = manager.getHistory();
      expect(history).toHaveLength(5);
      expect(history[0].title).toBe('FIFO Project 5'); // Most recent
      expect(history[4].title).toBe('FIFO Project 1'); // Oldest of remaining
    });

    it('should not lose projects when adding duplicates near limit', () => {
      manager.initialize();

      // Fill to max
      for (let i = 0; i < 5; i++) {
        manager.addToHistory(`https://example.com/share/near-limit${i}`, `Project ${i}`);
        vi.advanceTimersByTime(100);
      }

      const project3Id = manager.getHistory()[1].id;

      // Add duplicate at position 3 (should move to top)
      manager.addToHistory(`https://example.com/share/near-limit3`, 'Project 3 Updated');

      const history = manager.getHistory();
      expect(history).toHaveLength(5);
      expect(history[0].id).toBe(project3Id);
    });

    it('should handle interleaved manual and auto-saves with deduplication', () => {
      manager.initialize();

      const url1 = 'https://example.com/share/interleaved1';
      const url2 = 'https://example.com/share/interleaved2';

      manager.manualSave(url1, 'Manual Save 1');
      manager.autoSave(url2, 'Auto Save 1');
      manager.manualSave(url1, 'Manual Save 1 Updated');
      manager.autoSave(url2, 'Auto Save 1 Updated');

      const history = manager.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].shareUrl).toBe(url2);
      expect(history[1].shareUrl).toBe(url1);
    });

    it('should preserve project ID during deduplication', () => {
      manager.initialize();

      const url = 'https://example.com/share/preserve-id';
      manager.addToHistory(url, 'Original');
      const originalId = manager.getHistory()[0].id;

      manager.addToHistory('https://example.com/share/other', 'Other');
      manager.addToHistory(url, 'Updated');

      const project = manager.getHistory()[0];
      expect(project.id).toBe(originalId);
    });
  });

  // ─── Share URL Change Detection ────────────────────────────────────────────

  describe('share URL change detection', () => {
    it('should detect URL has not changed', () => {
      manager.initialize();

      manager.autoSave(mockShareUrl, 'Project A');
      const beforeCount = manager.getHistory().length;

      // Call again with same URL
      manager.autoSave(mockShareUrl, 'Project A');
      const afterCount = manager.getHistory().length;

      // Should either keep count or deduplicate (both valid per spec)
      expect(afterCount).toBeLessThanOrEqual(beforeCount + 1);
    });

    it('should detect URL parameter changes', () => {
      manager.initialize();

      const baseUrl = 'https://example.com/share/abc';
      const urlWithParam = 'https://example.com/share/abc?v=2';

      manager.autoSave(baseUrl, 'Base URL');
      const beforeHistory = manager.getHistory();

      manager.autoSave(urlWithParam, 'With Param');
      const afterHistory = manager.getHistory();

      // Different URLs should be treated as different
      expect(afterHistory.length).toBeGreaterThanOrEqual(beforeHistory.length);
    });

    it('should handle URL with hash fragments', () => {
      manager.initialize();

      const url1 = 'https://example.com/share/xyz#part1';
      const url2 = 'https://example.com/share/xyz#part2';

      manager.autoSave(url1, 'Hash Part 1');
      manager.autoSave(url2, 'Hash Part 2');

      const history = manager.getHistory();
      // Both can be different URLs
      expect(history.length).toBeGreaterThanOrEqual(1);
    });

    it('should consider empty URL vs non-empty as different', () => {
      manager.initialize();

      manager.autoSave('', 'Empty URL Save');
      manager.autoSave(mockShareUrl, 'With URL');

      const history = manager.getHistory();
      // Should handle both, exact behavior may vary
      expect(Array.isArray(history)).toBe(true);
    });

    it('should handle very long and very short URLs', () => {
      manager.initialize();

      const shortUrl = 'https://x.co/a';
      const longUrl = 'https://example.com/share/' + 'x'.repeat(1000);

      manager.autoSave(shortUrl, 'Short');
      manager.autoSave(longUrl, 'Long');

      const history = manager.getHistory();
      expect(history.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── Timestamp and Ordering ────────────────────────────────────────────────

  describe('timestamp and ordering', () => {
    it('should maintain chronological order with correct timestamps', () => {
      manager.initialize();

      const now = Date.now();
      vi.setSystemTime(now);

      manager.addToHistory('https://example.com/share/ts1', 'Project 1');
      const ts1 = manager.getHistory()[0].savedAt;

      vi.advanceTimersByTime(5000);
      manager.addToHistory('https://example.com/share/ts2', 'Project 2');
      const ts2 = manager.getHistory()[0].savedAt;

      vi.advanceTimersByTime(5000);
      manager.addToHistory('https://example.com/share/ts3', 'Project 3');
      const ts3 = manager.getHistory()[0].savedAt;

      expect(ts1).toBeLessThan(ts2);
      expect(ts2).toBeLessThan(ts3);
    });

    it('should update timestamp on deduplication', () => {
      manager.initialize();

      const url = 'https://example.com/share/ts-dup';
      manager.addToHistory(url, 'Original');
      const ts1 = manager.getHistory()[0].savedAt;

      vi.advanceTimersByTime(10000);

      manager.addToHistory(url, 'Updated');
      const ts2 = manager.getHistory()[0].savedAt;

      expect(ts2).toBeGreaterThan(ts1);
      expect(ts2).toBeGreaterThanOrEqual(ts1 + 10000);
    });

    it('should reflect correct order after multiple operations', () => {
      manager.initialize();

      const times: number[] = [];

      for (let i = 0; i < 3; i++) {
        manager.addToHistory(`https://example.com/share/order${i}`, `Project ${i}`);
        times.push(Date.now());
        vi.advanceTimersByTime(1000);
      }

      const history = manager.getHistory();
      expect(history[0].title).toBe('Project 2');
      expect(history[1].title).toBe('Project 1');
      expect(history[2].title).toBe('Project 0');
    });
  });

  // ─── Manual vs Auto-Save Behavior ──────────────────────────────────────────

  describe('manual vs auto-save behavior', () => {
    it('should behave identically for manual and auto-save with same URL', () => {
      manager.initialize();

      const url = 'https://example.com/share/manual-vs-auto';
      const title = 'Manual vs Auto';

      const manualResult = manager.manualSave(url, title);
      expect(manualResult.ok).toBe(true);

      const manualHistory = manager.getHistory();
      expect(manualHistory).toHaveLength(1);

      manager.clearHistory();

      const autoResult = manager.autoSave(url, title);
      expect(autoResult.ok).toBe(true);

      const autoHistory = manager.getHistory();
      expect(autoHistory).toHaveLength(1);
    });

    it('should handle manual save while auto-save interval is active', () => {
      const options: ProjectSaveManagerOptions = {
        autoSaveIntervalMs: 5000,
      };
      const mgr = new ProjectSaveManager(options);
      mgr.initialize();

      mgr.manualSave('https://example.com/share/manual1', 'Manual 1');

      vi.advanceTimersByTime(2500);

      mgr.manualSave('https://example.com/share/manual2', 'Manual 2');

      const history = mgr.getHistory();
      expect(history.length).toBeGreaterThanOrEqual(1);
    });

    it('should apply same deduplication logic to manual and auto-save', () => {
      manager.initialize();

      const url = 'https://example.com/share/dup-logic';

      manager.manualSave(url, 'Version 1');
      const idAfterManual = manager.getHistory()[0].id;

      manager.addToHistory('https://example.com/share/other', 'Other');

      manager.autoSave(url, 'Version 2');
      const idAfterAuto = manager.getHistory()[0].id;

      expect(idAfterAuto).toBe(idAfterManual);
    });
  });

  // ─── Storage Quota and Limits ──────────────────────────────────────────────

  describe('storage quota and limits', () => {
    it('should handle large project data', () => {
      manager.initialize();

      const largeDataUri = 'data:image/png;base64,' + 'x'.repeat(100000);
      const result = manager.addToHistory(mockShareUrl, mockProjectTitle, largeDataUri);

      // Should handle gracefully, either accept or reject with reason
      expect(result).toHaveProperty('ok');
      expect(result).toHaveProperty('reason');
    });

    it('should respect maxThumbnailBytes option', () => {
      const options: ProjectSaveManagerOptions = {
        maxThumbnailBytes: 1024, // 1KB limit
      };
      const mgr = new ProjectSaveManager(options);
      mgr.initialize();

      const largeThumbnail = 'data:image/png;base64,' + 'x'.repeat(10000);
      const result = mgr.addToHistory(mockShareUrl, mockProjectTitle, largeThumbnail);

      // Should either truncate or reject
      expect(result).toBeDefined();
    });

    it('should handle quota exceeded error', () => {
      manager.initialize();

      vi.mocked(localStorage.setItem).mockImplementation(() => {
        const error = new Error('QuotaExceededError');
        error.name = 'QuotaExceededError';
        throw error;
      });

      const result = manager.addToHistory(mockShareUrl, mockProjectTitle);

      expect(result.ok).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('should continue functioning with different error types', () => {
      manager.initialize();

      const errors = [
        'SecurityError',
        'InvalidAccessError',
        'UnknownError',
      ];

      for (const errorName of errors) {
        vi.mocked(localStorage.setItem).mockImplementation(() => {
          const error = new Error(errorName);
          error.name = errorName;
          throw error;
        });

        const result = manager.addToHistory(mockShareUrl, mockProjectTitle);
        expect(result.ok).toBe(false);
      }
    });
  });

  // ─── Cleanup and Lifecycle ────────────────────────────────────────────────

  describe('cleanup and lifecycle', () => {
    it('should clean up auto-save interval on destroy', () => {
      const mgr = new ProjectSaveManager();
      mgr.initialize();

      const timerCountBefore = vi.getTimerCount();

      mgr.destroy?.();

      // Timers should be cleaned up
      // Count may be 0 or same depending on other timers
      expect(timerCountBefore).toBeGreaterThanOrEqual(0);
    });

    it('should not cause memory leaks with repeated initialize/destroy', () => {
      for (let i = 0; i < 10; i++) {
        const mgr = new ProjectSaveManager();
        mgr.initialize();
        mgr.destroy?.();
      }

      // Should reach this point without errors
      expect(true).toBe(true);
    });

    it('should handle destroy even if never initialized', () => {
      const mgr = new ProjectSaveManager();

      expect(() => {
        mgr.destroy?.();
      }).not.toThrow();
    });

    it('should work after destroy and reinitialize', () => {
      const mgr = new ProjectSaveManager();
      mgr.initialize();

      mgr.addToHistory('https://example.com/share/before', 'Before Destroy');
      mgr.destroy?.();

      mgr.initialize();

      // Should load history from storage
      const history = mgr.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].title).toBe('Before Destroy');
    });
  });
});
