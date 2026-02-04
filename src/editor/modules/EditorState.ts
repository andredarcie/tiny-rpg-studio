
class EditorState {
    selectedTileId: string | number | null;
    selectedNpcId: string | null;
    selectedNpcType: string | null;
    activeRoomIndex: number;
    placingNpc: boolean;
    placingEnemy: boolean;
    placingObjectType: string | null;
    selectedObjectType: string | null;
    selectedEnemyType: string | null;
    mapPainting: boolean;
    skipMapHistory: boolean;
    npcTextUpdateTimer: number | null;
    suppressNpcFormUpdates: boolean;
    conditionalDialogueExpanded: boolean;
    activeMobilePanel: string;
    npcVariantFilter: string;
    playerEndTextUpdateTimer: number | null;
    variablePanelCollapsed: boolean;
    skillPanelCollapsed: boolean;
    testPanelCollapsed: boolean;
    palettePanelCollapsed: boolean;
    editingColorIndex: number | null;

    constructor() {
        this.selectedTileId = null;
        this.selectedNpcId = null;
        this.selectedNpcType = null;
        this.activeRoomIndex = 0;
        this.placingNpc = false;
        this.placingEnemy = false;
        this.placingObjectType = null;
        this.selectedObjectType = null;
        this.selectedEnemyType = null;
        this.mapPainting = false;
        this.skipMapHistory = false;
        this.npcTextUpdateTimer = null;
        this.suppressNpcFormUpdates = false;
        this.conditionalDialogueExpanded = false;
        this.activeMobilePanel = 'tiles';
        this.npcVariantFilter = 'human';
        this.playerEndTextUpdateTimer = null;
        this.variablePanelCollapsed = true;
        this.skillPanelCollapsed = true;
        this.testPanelCollapsed = true;
        this.palettePanelCollapsed = true;
        this.editingColorIndex = null;
    }
}

export { EditorState };
