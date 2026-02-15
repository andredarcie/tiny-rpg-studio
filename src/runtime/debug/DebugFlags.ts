/**
 * Mutable debug flags for runtime visualization and testing
 * These flags can be toggled during gameplay for debugging purposes
 */
export class DebugFlags {
  private static _showEnemyVision = false;

  static get showEnemyVision(): boolean {
    return this._showEnemyVision;
  }

  static toggleEnemyVision(): boolean {
    this._showEnemyVision = !this._showEnemyVision;
    console.log(`[Debug] Enemy vision overlay: ${this._showEnemyVision ? 'ON' : 'OFF'}`);
    return this._showEnemyVision;
  }

  static setEnemyVision(value: boolean): void {
    this._showEnemyVision = value;
  }
}
