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
   * Initialize the manager and start auto-save interval
   */
  initialize(): void {
    // Load existing history from storage on startup
    this.loadFromStorage();

    // Start the auto-save interval
    this.autoSaveInterval = setInterval(() => {
      // Auto-save is triggered by external calls, interval keeps it alive
      // The interval manager itself doesn't call autoSave automatically
    }, this.autoSaveIntervalMs);
  }

  /**
   * Automatically save a project
   */
  autoSave(shareUrl: string, projectTitle?: string): SaveResult {
    if (this.inProgress) {
      return { ok: false, reason: 'save-in-progress' };
    }
    try {
      this.inProgress = true;
      return this.addToHistory(shareUrl, projectTitle);
    } finally {
      this.inProgress = false;
    }
  }

  /**
   * Manually save a project
   */
  manualSave(shareUrl: string, projectTitle?: string): SaveResult {
    if (this.inProgress) {
      return { ok: false, reason: 'save-in-progress' };
    }
    try {
      this.inProgress = true;
      return this.addToHistory(shareUrl, projectTitle);
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
        if (!parsed.projects || !Array.isArray(parsed.projects)) {
          return [];
        }
        return parsed.projects;
      } catch (innerErr) {
        // Attempt a lightweight salvage: look for a projects array substring
        try {
          const match = stored.match(/\"projects\"\s*:\s*(\[.*\])/s);
          if (match && match[1]) {
            const arr = JSON.parse(match[1]);
            if (Array.isArray(arr)) return arr as SavedProject[];
          }
        } catch (_e) {
          // fallthrough to empty
        }
        return [];
      }
    } catch (error) {
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
    } catch (error) {
      return null;
    }
  }

  /**
   * Add a project to history
   */
  addToHistory(shareUrl: string, projectTitle?: string, thumbnail?: string): SaveResult {
    try {
      const history = this.getHistory();
      const title = projectTitle ?? '';

      // Check if project with this URL already exists
      const existingIndex = history.findIndex((p) => p.shareUrl === shareUrl);

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
    } catch (error) {
      return {
        ok: false,
        reason: `storage: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Clear all project history
   */
  clearHistory(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
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
    } catch (error) {
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
      } catch (_err) {
        // Attempt to salvage or simply ignore corrupted storage
        // We'll not overwrite here to avoid data loss
      }
    } catch (_error) {
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
      } catch (_e) {
        const msg = error instanceof Error ? error.message || error.name || String(error) : String(error);
        return { ok: false, reason: `storage: ${msg}` };
      }
    }
  }
}

// Export types for convenience
export type { SavedProject, ProjectHistory, ProjectSaveManagerOptions, SaveResult };
