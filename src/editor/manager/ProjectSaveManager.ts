/**
 * ProjectSaveManager - Project saving functionality
 * 
 * Manages project history with auto-save capabilities, FIFO queue management,
 * and localStorage persistence.
 */

import type { SavedProject, ProjectHistory, ProjectSaveManagerOptions, SaveResult } from './ProjectSaveManager.types';

/**
 * Generate a simple UUID v4-like string
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${Math.random().toString(36).substr(2, 9)}`;
}

export class ProjectSaveManager {
  private autoSaveIntervalMs: number;
  private storageKey: string;
  private maxItems: number;
  private autoSaveInterval?: ReturnType<typeof setInterval>;
  private inProgress = false;

  constructor(options?: ProjectSaveManagerOptions) {
    this.autoSaveIntervalMs = options?.autoSaveIntervalMs ?? 120000;
    this.storageKey = options?.storageKey ?? 'tiny-rpg-projects-history';
    this.maxItems = options?.maxItems ?? 5;
  }

  /**
   * Initialize the manager and start auto-save interval.
   * @param getAutoSaveData - called on each interval tick to get the current share URL and title.
   *   If omitted or returns null, the interval fires but no save occurs.
   */
  initialize(getAutoSaveData?: () => { shareUrl: string; title?: string } | null): void {
    // Load existing history from storage on startup
    this.loadFromStorage();

    // Start the auto-save interval
    this.autoSaveInterval = setInterval(() => {
      try {
        const data = getAutoSaveData?.();
        if (data?.shareUrl) {
          this.autoSave(data.shareUrl, data.title);
        }
      } catch (error) {
        console.warn('[ProjectSaveManager] Auto-save tick failed.', error);
      }
    }, this.autoSaveIntervalMs);
  }

  /**
   * Automatically save a project (deduplicates by URL — no duplicate auto-saves)
   */
  autoSave(shareUrl: string, projectTitle?: string): SaveResult {
    if (this.inProgress) {
      return { ok: false, reason: 'save-in-progress' };
    }
    try {
      this.inProgress = true;
      return this.addToHistory(shareUrl, projectTitle, undefined, true);
    } finally {
      this.inProgress = false;
    }
  }

  /**
   * Manually save a project (always creates a new entry)
   */
  manualSave(shareUrl: string, projectTitle?: string): SaveResult {
    if (this.inProgress) {
      return { ok: false, reason: 'save-in-progress' };
    }
    try {
      this.inProgress = true;
      return this.addToHistory(shareUrl, projectTitle, undefined, false);
    } finally {
      this.inProgress = false;
    }
  }

  /**
   * Get saved projects history
   */
  getHistory(): SavedProject[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) {
        return [];
      }

      try {
        const parsed = JSON.parse(stored) as ProjectHistory;
        if (!Array.isArray(parsed.projects)) {
          return [];
        }
        return parsed.projects;
      } catch {
        // Attempt a lightweight salvage: look for a projects array substring
        try {
          const match = stored.match(/\"projects\"\s*:\s*(\[.*\])/s);
          if (match && match[1]) {
            const arr: unknown = JSON.parse(match[1]);
            if (Array.isArray(arr)) return arr as SavedProject[];
          }
        } catch {
          // fallthrough to empty
        }
        return [];
      }
    } catch {
      return [];
    }
  }

  /**
   * Load a specific project from history
   */
  loadProject(projectId: string): SavedProject | null {
    try {
      const history = this.getHistory();
      return history.find((p) => p.id === projectId) || null;
    } catch {
      return null;
    }
  }

  /**
   * Add a project to history
   */
  addToHistory(shareUrl: string, projectTitle?: string, thumbnail?: string, deduplicate = true): SaveResult {
    try {
      const history = this.getHistory();
      const title = projectTitle ?? '';

      const existingIndex = deduplicate
        ? history.findIndex((p) => p.shareUrl === shareUrl)
        : -1;

      if (existingIndex !== -1) {
        const existing = history.splice(existingIndex, 1)[0];
        existing.title = title;
        existing.thumbnail = thumbnail;
        existing.savedAt = Date.now();
        history.unshift(existing);
      } else {
        const newProject: SavedProject = {
          id: generateId(),
          shareUrl,
          title,
          savedAt: Date.now(),
          thumbnail,
        };
        history.unshift(newProject);
      }

      if (history.length > this.maxItems) {
        history.splice(this.maxItems);
      }

      const saved = this.saveToStorage(history);
      if (!saved.ok) return saved;
      return { ok: true, reason: undefined };
    } catch (storageError) {
      return {
        ok: false,
        reason: `storage: ${storageError instanceof Error ? storageError.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Clear all project history
   */
  clearHistory(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      // ignore
    }
  }

  /**
   * Remove a specific project from history
   */
  removeProject(projectId: string): boolean {
    try {
      const history = this.getHistory();
      const index = history.findIndex((p) => p.id === projectId);

      if (index === -1) {
        return false;
      }

      history.splice(index, 1);
      this.saveToStorage(history);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Destroy the manager and clean up resources
   */
  destroy(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = undefined;
    }
  }

  /**
   * Load history from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return;
      try {
        JSON.parse(stored);
      } catch {
        // Attempt to salvage or simply ignore corrupted storage
        // We'll not overwrite here to avoid data loss
      }
    } catch {
      // ignore
    }
  }

  /**
   * Save history to localStorage
   */
  private saveToStorage(history: SavedProject[]): SaveResult {
    const data: ProjectHistory = {
      projects: history,
      lastAutoSaveTime: Date.now(),
    };
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
      return { ok: true, reason: undefined };
    } catch (error) {
      // Handle quota exceeded or storage errors by bubbling a structured result
      // We can't throw here because callers expect SaveResult; instead, log and swallow
      // but provide a way to detect failure by returning a value from this method when needed
      try {
        const slimHistory = history.map((p) => ({ ...p, thumbnail: undefined }));
        const slimData: ProjectHistory = { projects: slimHistory, lastAutoSaveTime: Date.now() };
        localStorage.setItem(this.storageKey, JSON.stringify(slimData));
        return { ok: true, reason: undefined };
      } catch {
        const msg = error instanceof Error ? error.message || error.name || String(error) : String(error);
        return { ok: false, reason: `storage: ${msg}` };
      }
    }
  }
}

// Export types for convenience
export type { SavedProject, ProjectHistory, ProjectSaveManagerOptions, SaveResult };
