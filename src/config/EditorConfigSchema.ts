/**
 * Strongly-typed and validated editor configuration schema
 *
 * This schema ensures all configuration values are valid and type-safe.
 * It prevents invalid configurations at compile-time and runtime.
 */

export interface EditorCanvasConfig {
  readonly width: number;
  readonly height: number;
}

export interface EditorPreviewConfig {
  readonly npcSize: number;
  readonly enemySize: number;
  readonly objectSize: number;
  readonly tileSize: number;
}

export interface EditorGridConfig {
  readonly cellSize: number;
  readonly lineColor: string;
  readonly lineWidth: number;
}

export interface EditorHistoryConfig {
  readonly maxStates: number;
}

export interface EditorExportConfig {
  readonly defaultFileName: string;
  readonly mimeType: string;
}

export interface EditorShareConfig {
  readonly maxUrlLength: number;
}

/**
 * Type helpers for accessing nested config types
 */
export type EditorConfigShape = {
  canvas: EditorCanvasConfig;
  preview: EditorPreviewConfig;
  grid: EditorGridConfig;
  history: EditorHistoryConfig;
  export: EditorExportConfig;
  share: EditorShareConfig;
};

/**
 * Main editor configuration class with validation
 */
export class EditorConfigSchema {
  private _canvas: EditorCanvasConfig;
  private _preview: EditorPreviewConfig;
  private _grid: EditorGridConfig;
  private _history: EditorHistoryConfig;
  private _export: EditorExportConfig;
  private _share: EditorShareConfig;

  constructor(config: {
    canvas: EditorCanvasConfig;
    preview: EditorPreviewConfig;
    grid: EditorGridConfig;
    history: EditorHistoryConfig;
    export: EditorExportConfig;
    share: EditorShareConfig;
  }) {
    this._canvas = this.validateCanvas(config.canvas);
    this._preview = this.validatePreview(config.preview);
    this._grid = this.validateGrid(config.grid);
    this._history = this.validateHistory(config.history);
    this._export = this.validateExport(config.export);
    this._share = this.validateShare(config.share);
  }

  // Canvas getters
  get canvas(): EditorCanvasConfig {
    return { ...this._canvas };
  }

  // Preview getters
  get preview(): EditorPreviewConfig {
    return { ...this._preview };
  }

  // Grid getters
  get grid(): EditorGridConfig {
    return { ...this._grid };
  }

  // History getters
  get history(): EditorHistoryConfig {
    return { ...this._history };
  }

  // Export getters
  get export(): EditorExportConfig {
    return { ...this._export };
  }

  // Share getters
  get share(): EditorShareConfig {
    return { ...this._share };
  }

  // Validation methods
  private validateCanvas(canvas: EditorCanvasConfig): EditorCanvasConfig {
    if (!Number.isInteger(canvas.width) || canvas.width <= 0) {
      throw new Error(`Invalid canvas width: ${canvas.width}. Must be a positive integer.`);
    }
    if (!Number.isInteger(canvas.height) || canvas.height <= 0) {
      throw new Error(`Invalid canvas height: ${canvas.height}. Must be a positive integer.`);
    }
    return Object.freeze({ ...canvas });
  }

  private validatePreview(preview: EditorPreviewConfig): EditorPreviewConfig {
    if (!Number.isInteger(preview.npcSize) || preview.npcSize <= 0) {
      throw new Error(`Invalid NPC preview size: ${preview.npcSize}. Must be a positive integer.`);
    }
    if (!Number.isInteger(preview.enemySize) || preview.enemySize <= 0) {
      throw new Error(`Invalid enemy preview size: ${preview.enemySize}. Must be a positive integer.`);
    }
    if (!Number.isInteger(preview.objectSize) || preview.objectSize <= 0) {
      throw new Error(`Invalid object preview size: ${preview.objectSize}. Must be a positive integer.`);
    }
    if (!Number.isInteger(preview.tileSize) || preview.tileSize <= 0) {
      throw new Error(`Invalid tile preview size: ${preview.tileSize}. Must be a positive integer.`);
    }
    return Object.freeze({ ...preview });
  }

  private validateGrid(grid: EditorGridConfig): EditorGridConfig {
    if (!Number.isInteger(grid.cellSize) || grid.cellSize <= 0) {
      throw new Error(`Invalid grid cell size: ${grid.cellSize}. Must be a positive integer.`);
    }
    if (typeof grid.lineColor !== 'string' || !this.isValidColor(grid.lineColor)) {
      throw new Error(`Invalid grid line color: ${grid.lineColor}. Must be a valid color string.`);
    }
    if (typeof grid.lineWidth !== 'number' || grid.lineWidth <= 0) {
      throw new Error(`Invalid grid line width: ${grid.lineWidth}. Must be a positive number.`);
    }
    return Object.freeze({ ...grid });
  }

  private validateHistory(history: EditorHistoryConfig): EditorHistoryConfig {
    if (!Number.isInteger(history.maxStates) || history.maxStates <= 0) {
      throw new Error(`Invalid max history states: ${history.maxStates}. Must be a positive integer.`);
    }
    return Object.freeze({ ...history });
  }

  private validateExport(exportConfig: EditorExportConfig): EditorExportConfig {
    if (typeof exportConfig.defaultFileName !== 'string' || exportConfig.defaultFileName.length === 0) {
      throw new Error(`Invalid default file name: ${exportConfig.defaultFileName}. Must be a non-empty string.`);
    }
    if (typeof exportConfig.mimeType !== 'string' || exportConfig.mimeType.length === 0) {
      throw new Error(`Invalid MIME type: ${exportConfig.mimeType}. Must be a non-empty string.`);
    }
    return Object.freeze({ ...exportConfig });
  }

  private validateShare(share: EditorShareConfig): EditorShareConfig {
    if (!Number.isInteger(share.maxUrlLength) || share.maxUrlLength <= 0) {
      throw new Error(`Invalid max URL length: ${share.maxUrlLength}. Must be a positive integer.`);
    }
    return Object.freeze({ ...share });
  }

  private isValidColor(color: string): boolean {
    // Basic validation for hex colors and named colors
    return /^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/.test(color) ||
           /^[a-z]+$/i.test(color);
  }

  /**
   * Creates a deep immutable copy of the entire configuration
   */
  toJSON() {
    return {
      canvas: this.canvas,
      preview: this.preview,
      grid: this.grid,
      history: this.history,
      export: this.export,
      share: this.share,
    };
  }
}
