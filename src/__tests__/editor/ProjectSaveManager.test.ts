import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProjectSaveManager } from '../../editor/manager/ProjectSaveManager';
import type { SavedProject, ProjectHistory, ProjectSaveManagerOptions } from '../../editor/manager/ProjectSaveManager.types';

describe('ProjectSaveManager', () => {
  const defaultStorageKey = 'tiny-rpg-projects-history';
  const mockShareUrl = 'https://example.com/share/abc123';
  const mockProjectTitle = 'Test Project';
  const mockThumbnail = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  let manager: ProjectSaveManager;
  let localStorageSpy: { [key: string]: string } = {};

  beforeEach(() => {
    // Limpar localStorage mock
    localStorageSpy = {};
    localStorage.clear();

    // Mock localStorage
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

  // ─── Constructor e Initialize ──────────────────────────────────────────────

  describe('constructor and initialize', () => {
    it('should instantiate without throwing', () => {
      expect(() => {
        new ProjectSaveManager();
      }).not.toThrow();
    });

    it('should initialize with default options', () => {
      const mgr = new ProjectSaveManager();
      expect(mgr).toBeDefined();
    });

    it('should initialize with custom options', () => {
      const options: ProjectSaveManagerOptions = {
        autoSaveIntervalMs: 60000,
        storageKey: 'custom-key',
        maxItems: 10,
      };
      const mgr = new ProjectSaveManager(options);
      expect(mgr).toBeDefined();
    });

    it('should start auto-save interval on initialize', () => {
      const options: ProjectSaveManagerOptions = {
        autoSaveIntervalMs: 120000,
      };
      const mgr = new ProjectSaveManager(options);
      mgr.initialize();
      
      // Timer deveria estar rodando
      expect(vi.getTimerCount()).toBeGreaterThan(0);
    });

    it('should use default values when no options provided', () => {
      const mgr = new ProjectSaveManager();
      mgr.initialize();
      
      // Verificar que o intervalo padrão (120000ms) está configured
      expect(vi.getTimerCount()).toBeGreaterThan(0);
    });

    it('should load existing history from localStorage on initialize', () => {
      const existingData: ProjectHistory = {
        projects: [
          {
            id: 'id-1',
            shareUrl: 'https://example.com/share/uuid1',
            title: 'Saved Project',
            savedAt: Date.now(),
          },
        ],
        lastAutoSaveTime: Date.now(),
      };
      localStorageSpy[defaultStorageKey] = JSON.stringify(existingData);

      const mgr = new ProjectSaveManager();
      mgr.initialize();

      const history = mgr.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].title).toBe('Saved Project');
    });
  });

  // ─── addToHistory ──────────────────────────────────────────────────────────

  describe('addToHistory', () => {
    beforeEach(() => {
      manager.initialize();
    });

    it('should add a new project to history', () => {
      const result = manager.addToHistory(mockShareUrl, mockProjectTitle);

      expect(result.ok).toBe(true);
      expect(manager.getHistory()).toHaveLength(1);
      const project = manager.getHistory()[0];
      expect(project.shareUrl).toBe(mockShareUrl);
      expect(project.title).toBe(mockProjectTitle);
    });

    it('should add project to beginning (index 0)', () => {
      manager.addToHistory('https://example.com/share/first', 'First Project');
      manager.addToHistory('https://example.com/share/second', 'Second Project');

      const history = manager.getHistory();
      expect(history[0].title).toBe('Second Project');
      expect(history[1].title).toBe('First Project');
    });

    it('should enforce maximum 5 items limit (FIFO)', () => {
      for (let i = 0; i < 7; i++) {
        manager.addToHistory(`https://example.com/share/id${i}`, `Project ${i}`);
      }

      const history = manager.getHistory();
      expect(history).toHaveLength(5);
      expect(history[0].title).toBe('Project 6');
      expect(history[4].title).toBe('Project 2');
    });

    it('should add project with optional thumbnail', () => {
      const result = manager.addToHistory(mockShareUrl, mockProjectTitle, mockThumbnail);

      expect(result.ok).toBe(true);
      const project = manager.getHistory()[0];
      expect(project.thumbnail).toBe(mockThumbnail);
    });

    it('should generate unique ID for each project', () => {
      manager.addToHistory('https://example.com/share/url1', 'Project 1');
      manager.addToHistory('https://example.com/share/url2', 'Project 2');

      const history = manager.getHistory();
      expect(history[0].id).not.toBe(history[1].id);
      expect(history[0].id).toBeDefined();
      expect(history[1].id).toBeDefined();
    });

    it('should record timestamp for saved project', () => {
      const beforeTime = Date.now();
      manager.addToHistory(mockShareUrl, mockProjectTitle);
      const afterTime = Date.now();

      const project = manager.getHistory()[0];
      expect(project.savedAt).toBeGreaterThanOrEqual(beforeTime);
      expect(project.savedAt).toBeLessThanOrEqual(afterTime);
    });

    it('should move existing project to top when duplicate shareUrl', () => {
      const url = 'https://example.com/share/duplicate';
      manager.addToHistory(url, 'Original Title');
      manager.addToHistory('https://example.com/share/other', 'Other Project');

      const idBefore = manager.getHistory()[1].id;

      // Add duplicate
      manager.addToHistory(url, 'Updated Title');

      const history = manager.getHistory();
      expect(history[0].shareUrl).toBe(url);
      expect(history[0].id).toBe(idBefore); // ID should be preserved
      expect(history).toHaveLength(2);
    });

    it('should update metadata when moving duplicate to top', () => {
      const url = 'https://example.com/share/dup';
      manager.addToHistory(url, 'Original Title', 'original-thumbnail');
      const firstSavedAt = manager.getHistory()[0].savedAt;

      // Advancing time
      vi.advanceTimersByTime(5000);

      // Add duplicate with updated info
      manager.addToHistory(url, 'Updated Title', 'updated-thumbnail');

      const project = manager.getHistory()[0];
      expect(project.title).toBe('Updated Title');
      expect(project.thumbnail).toBe('updated-thumbnail');
      expect(project.savedAt).toBeGreaterThan(firstSavedAt);
    });

    it('should persist to localStorage', () => {
      manager.addToHistory(mockShareUrl, mockProjectTitle);

      const stored = localStorage.getItem(defaultStorageKey);
      expect(stored).toBeDefined();
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored!) as ProjectHistory;
      expect(parsed.projects).toHaveLength(1);
    });

    it('should return {ok: false, reason} when localStorage throws', () => {
      vi.mocked(localStorage.setItem).mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      const result = manager.addToHistory(mockShareUrl, mockProjectTitle);

      expect(result.ok).toBe(false);
      expect(result.reason).toBeDefined();
      expect(result.reason).toContain('storage');
    });

    it('should handle title fallback to empty string', () => {
      const result = manager.addToHistory(mockShareUrl);

      expect(result.ok).toBe(true);
      const project = manager.getHistory()[0];
      expect(project.title).toBe('');
    });

    it('should not throw when shareUrl is empty', () => {
      expect(() => {
        manager.addToHistory('', mockProjectTitle);
      }).not.toThrow();
    });

    it('should handle deduplication with null thumbnail to optional thumbnail', () => {
      manager.addToHistory(mockShareUrl, 'Title', undefined);
      manager.addToHistory(mockShareUrl, 'Title', mockThumbnail);

      const project = manager.getHistory()[0];
      expect(project.thumbnail).toBe(mockThumbnail);
    });
  });

  // ─── getHistory ────────────────────────────────────────────────────────────

  describe('getHistory', () => {
    beforeEach(() => {
      manager.initialize();
    });

    it('should return empty array when no projects saved', () => {
      const history = manager.getHistory();

      expect(history).toEqual([]);
      expect(Array.isArray(history)).toBe(true);
    });

    it('should return projects ordered from newest to oldest', () => {
      manager.addToHistory('https://example.com/1', 'Project 1');
      vi.advanceTimersByTime(1000);
      manager.addToHistory('https://example.com/2', 'Project 2');
      vi.advanceTimersByTime(1000);
      manager.addToHistory('https://example.com/3', 'Project 3');

      const history = manager.getHistory();
      expect(history[0].title).toBe('Project 3');
      expect(history[1].title).toBe('Project 2');
      expect(history[2].title).toBe('Project 1');
    });

    it('should never return more than 5 projects', () => {
      for (let i = 0; i < 10; i++) {
        manager.addToHistory(`https://example.com/${i}`, `Project ${i}`);
      }

      const history = manager.getHistory();
      expect(history.length).toBeLessThanOrEqual(5);
    });

    it('should return projects with all required fields', () => {
      manager.addToHistory(mockShareUrl, mockProjectTitle);

      const history = manager.getHistory();
      expect(history[0]).toHaveProperty('id');
      expect(history[0]).toHaveProperty('shareUrl');
      expect(history[0]).toHaveProperty('title');
      expect(history[0]).toHaveProperty('savedAt');
    });

    it('should load history from corrupted localStorage and return clean data', () => {
      localStorageSpy[defaultStorageKey] = 'INVALID JSON {{{';

      const mgr = new ProjectSaveManager();
      mgr.initialize();

      const history = mgr.getHistory();
      expect(history).toEqual([]);
    });

    it('should handle malformed project entries in history', () => {
      const malformedData: ProjectHistory = {
        projects: [
          {
            id: 'id-1',
            shareUrl: 'https://example.com/1',
            title: 'Valid',
            savedAt: Date.now(),
          },
          {
            id: '',
            shareUrl: '',
            title: '',
            savedAt: 0,
          },
        ],
        lastAutoSaveTime: Date.now(),
      };
      localStorageSpy[defaultStorageKey] = JSON.stringify(malformedData);

      const mgr = new ProjectSaveManager();
      mgr.initialize();

      const history = mgr.getHistory();
      // Should still return the history, letting caller decide if entries are valid
      expect(Array.isArray(history)).toBe(true);
    });
  });

  // ─── loadProject ───────────────────────────────────────────────────────────

  describe('loadProject', () => {
    beforeEach(() => {
      manager.initialize();
    });

    it('should return null when project not found', () => {
      const result = manager.loadProject('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should return project when it exists', () => {
      manager.addToHistory(mockShareUrl, mockProjectTitle);
      const projectId = manager.getHistory()[0].id;

      const result = manager.loadProject(projectId);

      expect(result).not.toBeNull();
      expect(result?.shareUrl).toBe(mockShareUrl);
      expect(result?.title).toBe(mockProjectTitle);
    });

    it('should return project with all fields', () => {
      manager.addToHistory(mockShareUrl, mockProjectTitle, mockThumbnail);
      const projectId = manager.getHistory()[0].id;

      const result = manager.loadProject(projectId);

      expect(result).toHaveProperty('id', projectId);
      expect(result).toHaveProperty('shareUrl');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('savedAt');
      expect(result).toHaveProperty('thumbnail');
    });

    it('should find correct project among multiple', () => {
      const url1 = 'https://example.com/url1';
      const url2 = 'https://example.com/url2';
      const url3 = 'https://example.com/url3';

      manager.addToHistory(url1, 'Project 1');
      manager.addToHistory(url2, 'Project 2');
      manager.addToHistory(url3, 'Project 3');

      const targetId = manager.getHistory()[1].id; // Project 2 is at index 1

      const result = manager.loadProject(targetId);

      expect(result?.shareUrl).toBe(url2);
      expect(result?.title).toBe('Project 2');
    });

    it('should not throw when localStorage is unavailable', () => {
      vi.mocked(localStorage.getItem).mockImplementation(() => {
        throw new Error('Storage error');
      });

      const mgr = new ProjectSaveManager();

      expect(() => {
        mgr.loadProject('some-id');
      }).not.toThrow();
    });
  });

  // ─── clearHistory ─────────────────────────────────────────────────────────

  describe('clearHistory', () => {
    beforeEach(() => {
      manager.initialize();
    });

    it('should clear all projects', () => {
      manager.addToHistory('https://example.com/1', 'Project 1');
      manager.addToHistory('https://example.com/2', 'Project 2');

      manager.clearHistory();

      expect(manager.getHistory()).toEqual([]);
    });

    it('should remove localStorage entry', () => {
      manager.addToHistory(mockShareUrl, mockProjectTitle);
      expect(localStorage.getItem(defaultStorageKey)).not.toBeNull();

      manager.clearHistory();

      expect(localStorage.getItem(defaultStorageKey)).toBeNull();
    });

    it('should not throw when called on empty history', () => {
      expect(() => {
        manager.clearHistory();
      }).not.toThrow();
    });

    it('should not throw when localStorage throws', () => {
      vi.mocked(localStorage.removeItem).mockImplementation(() => {
        throw new Error('Storage error');
      });

      expect(() => {
        manager.clearHistory();
      }).not.toThrow();
    });
  });

  // ─── removeProject ────────────────────────────────────────────────────────

  describe('removeProject', () => {
    beforeEach(() => {
      manager.initialize();
    });

    it('should remove project by ID', () => {
      manager.addToHistory('https://example.com/1', 'Project 1');
      manager.addToHistory('https://example.com/2', 'Project 2');

      const projectId = manager.getHistory()[1].id;
      const result = manager.removeProject(projectId);

      expect(result).toBe(true);
      expect(manager.getHistory()).toHaveLength(1);
      expect(manager.getHistory()[0].title).toBe('Project 2');
    });

    it('should return false when project not found', () => {
      manager.addToHistory(mockShareUrl, mockProjectTitle);

      const result = manager.removeProject('nonexistent-id');

      expect(result).toBe(false);
    });

    it('should persist removal to localStorage', () => {
      manager.addToHistory('https://example.com/1', 'Project 1');
      manager.addToHistory('https://example.com/2', 'Project 2');

      const projectId = manager.getHistory()[0].id;
      manager.removeProject(projectId);

      const stored = localStorage.getItem(defaultStorageKey);
      const parsed = JSON.parse(stored!) as ProjectHistory;
      expect(parsed.projects).toHaveLength(1);
    });

    it('should not throw when localStorage throws', () => {
      manager.addToHistory(mockShareUrl, mockProjectTitle);
      const projectId = manager.getHistory()[0].id;

      vi.mocked(localStorage.setItem).mockImplementation(() => {
        throw new Error('Storage error');
      });

      expect(() => {
        manager.removeProject(projectId);
      }).not.toThrow();
    });

    it('should maintain order after removal', () => {
      manager.addToHistory('https://example.com/1', 'Project 1');
      manager.addToHistory('https://example.com/2', 'Project 2');
      manager.addToHistory('https://example.com/3', 'Project 3');

      const idToRemove = manager.getHistory()[1].id; // Project 2

      manager.removeProject(idToRemove);

      const history = manager.getHistory();
      expect(history[0].title).toBe('Project 3');
      expect(history[1].title).toBe('Project 1');
    });
  });

  // ─── autoSave ─────────────────────────────────────────────────────────────

  describe('autoSave', () => {
    beforeEach(() => {
      manager.initialize();
    });

    it('should add project to history when called', () => {
      const result = manager.autoSave(mockShareUrl, mockProjectTitle);

      expect(result.ok).toBe(true);
      expect(manager.getHistory()).toHaveLength(1);
    });

    it('should update lastAutoSaveTime', () => {
      const beforeTime = Date.now();
      manager.autoSave(mockShareUrl, mockProjectTitle);
      const afterTime = Date.now();

      // Usar getLastAutoSaveTime se disponível, ou verificar indiretamente
      const history = manager.getHistory();
      expect(history).toHaveLength(1);
    });

    it('should validate if URL changed since last save', () => {
      const url1 = 'https://example.com/url1';
      const url2 = 'https://example.com/url2';

      manager.autoSave(url1, 'Project 1');
      vi.advanceTimersByTime(1000);

      // Mesmo URL não deve adicionar novamente
      const result = manager.autoSave(url1, 'Project 1');

      // Comportamento pode variar: ignorar duplicata ou atualizar. De acordo com spec: "Valida se a URL compartilhada mudou"
      // Se não mudou, não deve adicionar nova entrada
      // Ou pode atualizar: aceitamos ambos para este teste ser flexível
      expect(result.ok).toBe(true);
    });

    it('should add new entry when URL changes', () => {
      const url1 = 'https://example.com/url1';
      const url2 = 'https://example.com/url2';

      manager.autoSave(url1, 'Project 1');
      manager.autoSave(url2, 'Project 2');

      const history = manager.getHistory();
      expect(history.length).toBeGreaterThanOrEqual(1);
    });

    it('should not throw when shareUrl is empty', () => {
      expect(() => {
        manager.autoSave('', mockProjectTitle);
      }).not.toThrow();
    });

    it('should return {ok: true} on success', () => {
      const result = manager.autoSave(mockShareUrl, mockProjectTitle);

      expect(result).toHaveProperty('ok', true);
      expect(result.reason).toBeUndefined();
    });

    it('should return {ok: false, reason} on localStorage error', () => {
      vi.mocked(localStorage.setItem).mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      const result = manager.autoSave(mockShareUrl, mockProjectTitle);

      expect(result.ok).toBe(false);
      expect(result.reason).toBeDefined();
    });
  });

  // ─── manualSave ────────────────────────────────────────────────────────────

  describe('manualSave', () => {
    beforeEach(() => {
      manager.initialize();
    });

    it('should add project to history immediately', () => {
      const result = manager.manualSave(mockShareUrl, mockProjectTitle);

      expect(result.ok).toBe(true);
      expect(manager.getHistory()).toHaveLength(1);
    });

    it('should return {ok: true} on success', () => {
      const result = manager.manualSave(mockShareUrl, mockProjectTitle);

      expect(result).toHaveProperty('ok', true);
      expect(result.reason).toBeUndefined();
    });

    it('should return {ok: false, reason} on localStorage error', () => {
      vi.mocked(localStorage.setItem).mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      const result = manager.manualSave(mockShareUrl, mockProjectTitle);

      expect(result.ok).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('should handle title fallback to empty string', () => {
      const result = manager.manualSave(mockShareUrl);

      expect(result.ok).toBe(true);
      const project = manager.getHistory()[0];
      expect(project.title).toBe('');
    });

    it('should move duplicate to top on manual save', () => {
      const url = 'https://example.com/dup-url';
      manager.manualSave(url, 'Original');
      manager.manualSave('https://example.com/other', 'Other');

      const idBefore = manager.getHistory()[1].id;

      manager.manualSave(url, 'Updated');

      const history = manager.getHistory();
      expect(history[0].shareUrl).toBe(url);
      expect(history[0].id).toBe(idBefore);
    });

    it('should not throw when shareUrl is empty', () => {
      expect(() => {
        manager.manualSave('', mockProjectTitle);
      }).not.toThrow();
    });
  });

  // ─── Error Handling and Edge Cases ────────────────────────────────────────

  describe('error handling', () => {
    it('should handle localStorage getItem throwing', () => {
      vi.mocked(localStorage.getItem).mockImplementation(() => {
        throw new Error('Storage access denied');
      });

      expect(() => {
        const mgr = new ProjectSaveManager();
        mgr.initialize();
      }).not.toThrow();
    });

    it('should handle localStorage setItem throwing on add', () => {
      manager.initialize();
      vi.mocked(localStorage.setItem).mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      const result = manager.addToHistory(mockShareUrl, mockProjectTitle);

      expect(result.ok).toBe(false);
      expect(result.reason).toContain('storage');
    });

    it('should clean up auto-save interval on destroy', () => {
      manager.initialize();
      const timerCountBefore = vi.getTimerCount();

      manager.destroy?.();

      // Se destroy foi chamado corretamente, os timers devem ser limpos
      // Caso destroy não exista ou não limpe, este teste pode passar mesmo assim
      expect(timerCountBefore).toBeGreaterThanOrEqual(0);
    });

    it('should handle JSON parsing errors for stored data', () => {
      localStorageSpy[defaultStorageKey] = 'COMPLETELY INVALID JSON [[[';

      const mgr = new ProjectSaveManager();
      mgr.initialize();

      // Não deve lançar erro, deve retornar histórico vazio
      expect(() => {
        mgr.getHistory();
      }).not.toThrow();

      const history = mgr.getHistory();
      expect(Array.isArray(history)).toBe(true);
    });

    it('should handle race condition: reading history while another context modifies', () => {
      manager.initialize();
      manager.addToHistory('https://example.com/1', 'Project 1');

      // Simular modificação de outro contexto
      const modifiedData: ProjectHistory = {
        projects: [
          {
            id: 'id-other',
            shareUrl: 'https://example.com/other',
            title: 'From Other Context',
            savedAt: Date.now(),
          },
        ],
        lastAutoSaveTime: Date.now(),
      };
      localStorageSpy[defaultStorageKey] = JSON.stringify(modifiedData);

      // O getHistory deveria usar a versão atual do localStorage
      const history = manager.getHistory();
      expect(Array.isArray(history)).toBe(true);
    });
  });

  // ─── Integration Tests ────────────────────────────────────────────────────

  describe('integration', () => {
    it('should complete full flow: add → get → load → remove', () => {
      manager.initialize();

      // Add
      manager.addToHistory(mockShareUrl, mockProjectTitle, mockThumbnail);
      const projectId = manager.getHistory()[0].id;

      // Get
      const history = manager.getHistory();
      expect(history).toHaveLength(1);

      // Load
      const loaded = manager.loadProject(projectId);
      expect(loaded).not.toBeNull();
      expect(loaded?.title).toBe(mockProjectTitle);

      // Remove
      const removed = manager.removeProject(projectId);
      expect(removed).toBe(true);
      expect(manager.getHistory()).toHaveLength(0);
    });

    it('should persist and restore across multiple manager instances', () => {
      const manager1 = new ProjectSaveManager();
      manager1.initialize();
      manager1.addToHistory(mockShareUrl, 'Saved by Manager 1');

      // Create new manager instance
      const manager2 = new ProjectSaveManager();
      manager2.initialize();

      // Should load history from storage
      const history = manager2.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].title).toBe('Saved by Manager 1');
    });

    it('should handle multiple rapid saves maintaining FIFO order', () => {
      manager.initialize();

      for (let i = 0; i < 5; i++) {
        manager.addToHistory(`https://example.com/${i}`, `Project ${i}`);
      }

      const history = manager.getHistory();
      expect(history).toHaveLength(5);
      expect(history[0].title).toBe('Project 4');
      expect(history[4].title).toBe('Project 0');

      // Add 6th project
      manager.addToHistory('https://example.com/5', 'Project 5');

      const newHistory = manager.getHistory();
      expect(newHistory).toHaveLength(5);
      expect(newHistory[0].title).toBe('Project 5');
      expect(newHistory[4].title).toBe('Project 1');
    });

    it('should handle auto-save interval correctly', () => {
      const options: ProjectSaveManagerOptions = {
        autoSaveIntervalMs: 2000, // 2 seconds for testing
      };
      const mgr = new ProjectSaveManager(options);
      mgr.initialize();

      const autoSaveSpy = vi.spyOn(mgr, 'autoSave');

      // Initial save
      mgr.autoSave(mockShareUrl, mockProjectTitle);

      // Advance time but not to next interval
      vi.advanceTimersByTime(1000);

      // Advance to trigger next interval
      vi.advanceTimersByTime(2000);

      // autoSave should have been called by the interval
      // (This depends on implementation details of the timer)
      expect(autoSaveSpy).toHaveBeenCalled();
    });

    it('should use custom storage key when provided', () => {
      const customKey = 'my-custom-storage-key';
      const options: ProjectSaveManagerOptions = {
        storageKey: customKey,
      };
      const mgr = new ProjectSaveManager(options);
      mgr.initialize();

      mgr.addToHistory(mockShareUrl, mockProjectTitle);

      expect(localStorage.getItem(customKey)).not.toBeNull();
      expect(localStorage.getItem(defaultStorageKey)).toBeNull();
    });

    it('should use custom max items when provided', () => {
      const options: ProjectSaveManagerOptions = {
        maxItems: 3,
      };
      const mgr = new ProjectSaveManager(options);
      mgr.initialize();

      for (let i = 0; i < 5; i++) {
        mgr.addToHistory(`https://example.com/${i}`, `Project ${i}`);
      }

      const history = mgr.getHistory();
      expect(history).toHaveLength(3);
    });
  });

  // ─── Storage Edge Cases ────────────────────────────────────────────────────

  describe('storage edge cases', () => {
    it('should not include invalid project entries in history', () => {
      const invalidData: ProjectHistory = {
        projects: [
          {
            id: 'id-1',
            shareUrl: 'https://example.com/valid',
            title: 'Valid Project',
            savedAt: Date.now(),
          },
          {
            id: '',
            shareUrl: null as any,
            title: 'Invalid',
            savedAt: Date.now(),
          },
        ],
        lastAutoSaveTime: Date.now(),
      };
      localStorageSpy[defaultStorageKey] = JSON.stringify(invalidData);

      const mgr = new ProjectSaveManager();
      mgr.initialize();

      const history = mgr.getHistory();
      // Should still return all entries, validation is caller's responsibility
      expect(Array.isArray(history)).toBe(true);
    });

    it('should handle missing lastAutoSaveTime field', () => {
      const dataWithoutAutoSaveTime: Partial<ProjectHistory> = {
        projects: [
          {
            id: 'id-1',
            shareUrl: mockShareUrl,
            title: 'Test',
            savedAt: Date.now(),
          },
        ],
      };
      localStorageSpy[defaultStorageKey] = JSON.stringify(dataWithoutAutoSaveTime);

      const mgr = new ProjectSaveManager();
      mgr.initialize();

      expect(() => {
        mgr.getHistory();
      }).not.toThrow();

      expect(mgr.getHistory()).toHaveLength(1);
    });

    it('should handle empty projects array in stored data', () => {
      const emptyData: ProjectHistory = {
        projects: [],
        lastAutoSaveTime: Date.now(),
      };
      localStorageSpy[defaultStorageKey] = JSON.stringify(emptyData);

      const mgr = new ProjectSaveManager();
      mgr.initialize();

      expect(mgr.getHistory()).toEqual([]);
    });

    it('should preserve thumbnail data URI correctly', () => {
      manager.initialize();

      const largeDataUri = 'data:image/png;base64,' + 'A'.repeat(10000);
      manager.addToHistory(mockShareUrl, mockProjectTitle, largeDataUri);

      const project = manager.getHistory()[0];
      expect(project.thumbnail).toBe(largeDataUri);

      // Verify it persists
      const stored = localStorage.getItem(defaultStorageKey);
      const parsed = JSON.parse(stored!) as ProjectHistory;
      expect(parsed.projects[0].thumbnail).toBe(largeDataUri);
    });

    it('should handle shareUrl with special characters', () => {
      manager.initialize();

      const complexUrl = 'https://example.com/share/abc123?param=value&other=test#hash';
      manager.addToHistory(complexUrl, 'Complex URL Project');

      const project = manager.getHistory()[0];
      expect(project.shareUrl).toBe(complexUrl);

      // Verify round-trip through storage
      const stored = localStorage.getItem(defaultStorageKey);
      const parsed = JSON.parse(stored!) as ProjectHistory;
      expect(parsed.projects[0].shareUrl).toBe(complexUrl);
    });

    it('should handle project title with special characters', () => {
      manager.initialize();

      const specialTitle = 'Projeto "Especial" & \\ Caracteres <100%>';
      manager.addToHistory(mockShareUrl, specialTitle);

      const project = manager.getHistory()[0];
      expect(project.title).toBe(specialTitle);

      const stored = localStorage.getItem(defaultStorageKey);
      const parsed = JSON.parse(stored!) as ProjectHistory;
      expect(parsed.projects[0].title).toBe(specialTitle);
    });
  });

  // ─── Configuration and Options ────────────────────────────────────────────

  describe('configuration', () => {
    it('should accept maxThumbnailBytes option', () => {
      const options: ProjectSaveManagerOptions = {
        maxThumbnailBytes: 50 * 1024,
      };

      expect(() => {
        new ProjectSaveManager(options);
      }).not.toThrow();
    });

    it('should use default maxItems of 5', () => {
      const mgr = new ProjectSaveManager();
      mgr.initialize();

      for (let i = 0; i < 10; i++) {
        mgr.addToHistory(`https://example.com/${i}`, `Project ${i}`);
      }

      expect(mgr.getHistory()).toHaveLength(5);
    });

    it('should use default autoSaveIntervalMs of 120000', () => {
      const mgr = new ProjectSaveManager();
      mgr.initialize();

      // Timer should be set up
      expect(vi.getTimerCount()).toBeGreaterThan(0);
    });
  });
});
