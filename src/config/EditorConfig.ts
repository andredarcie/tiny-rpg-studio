/**
 * Centralized editor configuration
 *
 * This file contains all constants and configurable values for the editor.
 * Uses EditorConfigSchema for type safety and validation.
 */

import { EditorConfigSchema } from './EditorConfigSchema';

/**
 * Validated and immutable editor configuration instance
 *
 * All values are validated at instantiation time to ensure correctness.
 */
export const EditorConfig = new EditorConfigSchema({
  /**
   * Editor canvas configuration
   */
  canvas: {
    /** Editor main canvas width in pixels */
    width: 384,
    /** Editor main canvas height in pixels */
    height: 384,
  },

  /**
   * Sprite preview configuration
   */
  preview: {
    /** NPC preview canvas size (pixels) */
    npcSize: 48,
    /** Enemy preview canvas size (pixels) */
    enemySize: 48,
    /** Object preview canvas size (pixels) */
    objectSize: 48,
    /** Tile preview canvas size (pixels) */
    tileSize: 64,
  },

  /**
   * Grid and positioning configuration
   */
  grid: {
    /** Grid cell size in pixels */
    cellSize: 48,
    /** Grid line color */
    lineColor: '#cccccc',
    /** Grid line width */
    lineWidth: 1,
  },

  /**
   * Undo/redo configuration
   */
  history: {
    /** Maximum number of states in history */
    maxStates: 50,
  },

  /**
   * Export configuration
   */
  export: {
    /** Default exported file name */
    defaultFileName: 'my-rpg-game.html',
    /** MIME type for download */
    mimeType: 'text/html',
  },

  /**
   * Share / URL configuration
   */
  share: {
    /**
     * Max share-URL length (in characters) before warning the user that the
     * game is too large to share via URL. The game data lives in the URL
     * fragment (never sent to a server), so the binding limit is the browser
     * address bar — Chrome's is the most restrictive at ~32,779 chars. Above
     * this the user should Export (HTML) instead, which has no URL limit.
     */
    maxUrlLength: 32000,
  },
});

/**
 * Type helper for editor configuration
 */
export type EditorConfigType = typeof EditorConfig;
