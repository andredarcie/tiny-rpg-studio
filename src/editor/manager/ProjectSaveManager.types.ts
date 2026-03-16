/**
 * Types for ProjectSaveManager - Project saving functionality
 */

export interface SavedProject {
  id: string;                    // UUID único
  shareUrl: string;             // URL compartilhada do projeto
  title: string;                // Nome/título do projeto
  savedAt: number;              // Timestamp do salvamento
  thumbnail?: string;           // Data URI da miniatura (opcional)
}

export interface ProjectHistory {
  projects: SavedProject[];
  lastAutoSaveTime: number;
}

/** Opções do manager */
export interface ProjectSaveManagerOptions {
  autoSaveIntervalMs?: number; // default 120000
  storageKey?: string; // default 'tiny-rpg-projects-history'
  maxItems?: number; // default 5
  maxThumbnailBytes?: number; // recomendado, ex: 50 * 1024
}

/** Resultado de operações de salvamento */
export interface SaveResult {
  ok: boolean;
  reason?: string;
}
