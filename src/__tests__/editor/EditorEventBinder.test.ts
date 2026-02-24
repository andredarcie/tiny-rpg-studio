import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../runtime/debug/DebugFlags', () => ({
    DebugFlags: { setEnemyVision: vi.fn() }
}));

import { EditorEventBinder } from '../../editor/manager/EditorEventBinder';
import { DebugFlags } from '../../runtime/debug/DebugFlags';

type EventBinderManager = ConstructorParameters<typeof EditorEventBinder>[0];
type EventBinderFixture = ReturnType<typeof makeManager>;
type TestNpcSprite = { id: string; type: string; roomIndex?: number; placed?: boolean };

function asEventBinderManager(manager: EventBinderFixture['manager']): EventBinderManager {
    return manager as unknown as EventBinderManager;
}

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeDom() {
    const btnNpcDelete = document.createElement('button');
    const btnGenerateUrl = document.createElement('button');
    const btnUndo = document.createElement('button');
    const btnRedo = document.createElement('button');
    const titleInput = document.createElement('input');
    const authorInput = document.createElement('input');
    const npcText = document.createElement('textarea');
    const npcConditionalText = document.createElement('textarea');
    const npcConditionalVariable = document.createElement('select');
    const npcRewardVariable = document.createElement('select');
    const npcConditionalRewardVariable = document.createElement('select');
    const btnToggleNpcConditional = document.createElement('button');
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    const editorCanvas = document.createElement('canvas');

    const npcVariantBtn1 = document.createElement('button');
    npcVariantBtn1.dataset.npcVariantFilter = 'hero';
    const npcVariantBtn2 = document.createElement('button');
    npcVariantBtn2.dataset.npcVariantFilter = 'villain';
    const npcVariantButtons = [npcVariantBtn1, npcVariantBtn2];

    const objCategoryBtn1 = document.createElement('button');
    objCategoryBtn1.dataset.objectCategoryFilter = 'items';
    const objCategoryBtn2 = document.createElement('button');
    objCategoryBtn2.dataset.objectCategoryFilter = 'props';
    const objectCategoryButtons = [objCategoryBtn1, objCategoryBtn2];

    const enemyTypes = document.createElement('div');
    const enemiesList = document.createElement('div');
    const objectTypes = document.createElement('div');
    const objectsList = document.createElement('div');
    const tileList = document.createElement('div');
    const npcsList = document.createElement('div');

    const mapNavBtn1 = document.createElement('button');
    mapNavBtn1.dataset.direction = 'north';
    const mapNavBtn2 = document.createElement('button');
    mapNavBtn2.dataset.direction = 'south';
    const mapNavButtons = [mapNavBtn1, mapNavBtn2];

    const mobileNavBtn1 = document.createElement('button');
    mobileNavBtn1.dataset.mobileTarget = 'map';
    const mobileNavBtn2 = document.createElement('button');
    mobileNavBtn2.dataset.mobileTarget = 'npcs';
    const mobileNavButtons = [mobileNavBtn1, mobileNavBtn2];

    const worldGrid = document.createElement('div');
    const projectVariablesToggle = document.createElement('button');
    const projectSkillsToggle = document.createElement('button');
    const projectTestToggle = document.createElement('button');
    const projectTestStartLevel = document.createElement('select');
    const projectTestSkillList = document.createElement('div');

    // Add child checkboxes to projectTestSkillList
    const skillCheckbox1 = document.createElement('input');
    skillCheckbox1.type = 'checkbox';
    skillCheckbox1.dataset.skillId = 'skill-fire';
    skillCheckbox1.checked = true;
    const skillCheckbox2 = document.createElement('input');
    skillCheckbox2.type = 'checkbox';
    skillCheckbox2.dataset.skillId = 'skill-ice';
    skillCheckbox2.checked = false;
    projectTestSkillList.appendChild(skillCheckbox1);
    projectTestSkillList.appendChild(skillCheckbox2);

    const projectTestGodMode = document.createElement('input');
    projectTestGodMode.type = 'checkbox';
    const projectTestDebugVision = document.createElement('input');
    projectTestDebugVision.type = 'checkbox';

    const shareUrlInput = document.createElement('input');
    shareUrlInput.select = vi.fn();

    return {
        btnNpcDelete,
        btnGenerateUrl,
        btnUndo,
        btnRedo,
        titleInput,
        authorInput,
        npcText,
        npcConditionalText,
        npcConditionalVariable,
        npcRewardVariable,
        npcConditionalRewardVariable,
        btnToggleNpcConditional,
        fileInput,
        editorCanvas,
        npcVariantButtons,
        objectCategoryButtons,
        enemyTypes,
        enemiesList,
        objectTypes,
        objectsList,
        tileList,
        npcsList,
        mapNavButtons,
        mobileNavButtons,
        worldGrid,
        projectVariablesToggle,
        projectSkillsToggle,
        projectTestToggle,
        projectTestStartLevel,
        projectTestSkillList,
        projectTestGodMode,
        projectTestDebugVision,
        shareUrlInput,
    };
}

function makeManager() {
    const dom = makeDom();

    const state = {
        placingObjectType: null as string | null,
        activeRoomIndex: 0,
        conditionalDialogueExpanded: false,
    };

    const renderService = {
        updateNpcForm: vi.fn(),
        updateSelectedTilePreview: vi.fn(),
        renderTileList: vi.fn(),
        renderVariableUsage: vi.fn(),
        renderSkillList: vi.fn(),
        renderTestTools: vi.fn(),
    };

    const npcService = {
        removeSelectedNpc: vi.fn(),
        updateNpcText: vi.fn(),
        updateNpcConditionalText: vi.fn(),
        handleConditionVariableChange: vi.fn(),
        handleRewardVariableChange: vi.fn(),
        handleConditionalRewardVariableChange: vi.fn(),
        setVariantFilter: vi.fn(),
        updateNpcSelection: vi.fn(),
        clearSelection: vi.fn(),
        populateVariableSelect: vi.fn(),
    };

    const enemyService = {
        selectEnemyType: vi.fn(),
        removeEnemy: vi.fn(),
        handleEnemyVariableChange: vi.fn(),
        deactivatePlacement: vi.fn(),
    };

    const objectService = {
        selectObjectType: vi.fn(),
        removeObject: vi.fn(),
        togglePlacement: vi.fn(),
        setCategoryFilter: vi.fn(),
    };

    const shareService = {
        generateShareableUrl: vi.fn(() => Promise.resolve()),
        loadGameFile: vi.fn(),
    };

    const tileService = {
        startPaint: vi.fn(),
        continuePaint: vi.fn(),
        finishPaint: vi.fn(),
    };

    const worldService = {
        setActiveRoom: vi.fn(),
        moveActiveRoom: vi.fn(),
    };

    const gameEngine = {
        getSprites: vi.fn((): TestNpcSprite[] => []),
        npcManager: {
            createNPC: vi.fn(() => ({ id: 'npc-1', type: 'hero' })),
        },
    };

    const manager = {
        state,
        renderService,
        npcService,
        enemyService,
        objectService,
        shareService,
        tileService,
        worldService,
        gameEngine,
        selectedTileId: null as number | null,
        undo: vi.fn(),
        redo: vi.fn(),
        toggleVariablePanel: vi.fn(),
        toggleSkillPanel: vi.fn(),
        toggleTestPanel: vi.fn(),
        updateGameMetadata: vi.fn(),
        setTestStartLevel: vi.fn(),
        setGodMode: vi.fn(),
        setTestSkills: vi.fn(),
        desselectAllAndRender: vi.fn(),
        handleKey: vi.fn(),
        handleCanvasResize: vi.fn(),
        updateMobilePanels: vi.fn(),
        setActiveMobilePanel: vi.fn(),
        get dom() { return dom; },
    };

    return { manager, dom, state, renderService, npcService, enemyService, objectService, shareService, tileService, worldService, gameEngine };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EditorEventBinder', () => {
    let manager: ReturnType<typeof makeManager>['manager'];
    let dom: ReturnType<typeof makeManager>['dom'];
    let state: ReturnType<typeof makeManager>['state'];
    let renderService: ReturnType<typeof makeManager>['renderService'];
    let npcService: ReturnType<typeof makeManager>['npcService'];
    let enemyService: ReturnType<typeof makeManager>['enemyService'];
    let objectService: ReturnType<typeof makeManager>['objectService'];
    let shareService: ReturnType<typeof makeManager>['shareService'];
    let tileService: ReturnType<typeof makeManager>['tileService'];
    let worldService: ReturnType<typeof makeManager>['worldService'];
    let gameEngine: ReturnType<typeof makeManager>['gameEngine'];
    let svc: EditorEventBinder;

    beforeEach(() => {
        vi.clearAllMocks();
        const built = makeManager();
        manager = built.manager;
        dom = built.dom;
        state = built.state;
        renderService = built.renderService;
        npcService = built.npcService;
        enemyService = built.enemyService;
        objectService = built.objectService;
        shareService = built.shareService;
        tileService = built.tileService;
        worldService = built.worldService;
        gameEngine = built.gameEngine;

        svc = new EditorEventBinder(asEventBinderManager(manager));
        svc.bind();
    });

    // 1. btnNpcDelete click
    it('btnNpcDelete click calls npcService.removeSelectedNpc', () => {
        dom.btnNpcDelete.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(npcService.removeSelectedNpc).toHaveBeenCalledTimes(1);
    });

    // 2. btnToggleNpcConditional click - toggles state and calls updateNpcForm
    it('btnToggleNpcConditional click toggles conditionalDialogueExpanded and calls updateNpcForm', () => {
        expect(state.conditionalDialogueExpanded).toBe(false);
        dom.btnToggleNpcConditional.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(state.conditionalDialogueExpanded).toBe(true);
        expect(renderService.updateNpcForm).toHaveBeenCalledTimes(1);
    });

    it('btnToggleNpcConditional click toggles back to false on second click', () => {
        dom.btnToggleNpcConditional.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        dom.btnToggleNpcConditional.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(state.conditionalDialogueExpanded).toBe(false);
        expect(renderService.updateNpcForm).toHaveBeenCalledTimes(2);
    });

    // 3. btnGenerateUrl click
    it('btnGenerateUrl click calls shareService.generateShareableUrl', () => {
        dom.btnGenerateUrl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(shareService.generateShareableUrl).toHaveBeenCalledTimes(1);
    });

    // 4. btnUndo click
    it('btnUndo click calls manager.undo', () => {
        dom.btnUndo.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(manager.undo).toHaveBeenCalledTimes(1);
    });

    // 5. btnRedo click
    it('btnRedo click calls manager.redo', () => {
        dom.btnRedo.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(manager.redo).toHaveBeenCalledTimes(1);
    });

    // 6. projectVariablesToggle click
    it('projectVariablesToggle click calls manager.toggleVariablePanel', () => {
        dom.projectVariablesToggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(manager.toggleVariablePanel).toHaveBeenCalledTimes(1);
    });

    // 7. projectSkillsToggle click
    it('projectSkillsToggle click calls manager.toggleSkillPanel', () => {
        dom.projectSkillsToggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(manager.toggleSkillPanel).toHaveBeenCalledTimes(1);
    });

    // 8. projectTestToggle click
    it('projectTestToggle click calls manager.toggleTestPanel', () => {
        dom.projectTestToggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(manager.toggleTestPanel).toHaveBeenCalledTimes(1);
    });

    // 9. titleInput input
    it('titleInput input event calls manager.updateGameMetadata', () => {
        dom.titleInput.value = 'My RPG';
        dom.titleInput.dispatchEvent(new Event('input', { bubbles: true }));
        expect(manager.updateGameMetadata).toHaveBeenCalledTimes(1);
    });

    // 10. authorInput input
    it('authorInput input event calls manager.updateGameMetadata', () => {
        dom.authorInput.value = 'Dev Author';
        dom.authorInput.dispatchEvent(new Event('input', { bubbles: true }));
        expect(manager.updateGameMetadata).toHaveBeenCalledTimes(1);
    });

    // 11. projectTestStartLevel change
    it('projectTestStartLevel change calls manager.setTestStartLevel with numeric value', () => {
        const option = document.createElement('option');
        option.value = '3';
        dom.projectTestStartLevel.appendChild(option);
        dom.projectTestStartLevel.value = '3';
        dom.projectTestStartLevel.dispatchEvent(new Event('change', { bubbles: true }));
        expect(manager.setTestStartLevel).toHaveBeenCalledWith(3);
    });

    // 12. projectTestGodMode change
    it('projectTestGodMode change calls manager.setGodMode with checked value', () => {
        dom.projectTestGodMode.checked = true;
        dom.projectTestGodMode.dispatchEvent(new Event('change', { bubbles: true }));
        expect(manager.setGodMode).toHaveBeenCalledWith(true);
    });

    it('projectTestGodMode change passes false when unchecked', () => {
        dom.projectTestGodMode.checked = false;
        dom.projectTestGodMode.dispatchEvent(new Event('change', { bubbles: true }));
        expect(manager.setGodMode).toHaveBeenCalledWith(false);
    });

    // 13. projectTestDebugVision change
    it('projectTestDebugVision change calls DebugFlags.setEnemyVision with checked value', () => {
        dom.projectTestDebugVision.checked = true;
        dom.projectTestDebugVision.dispatchEvent(new Event('change', { bubbles: true }));
        expect(DebugFlags.setEnemyVision).toHaveBeenCalledWith(true);
    });

    it('projectTestDebugVision change passes false when unchecked', () => {
        dom.projectTestDebugVision.checked = false;
        dom.projectTestDebugVision.dispatchEvent(new Event('change', { bubbles: true }));
        expect(DebugFlags.setEnemyVision).toHaveBeenCalledWith(false);
    });

    // 14. shareUrlInput focus
    it('shareUrlInput focus calls shareUrlInput.select()', () => {
        dom.shareUrlInput.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
        expect(dom.shareUrlInput.select).toHaveBeenCalledTimes(1);
    });

    // 15. shareUrlInput click
    it('shareUrlInput click calls shareUrlInput.select()', () => {
        dom.shareUrlInput.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(dom.shareUrlInput.select).toHaveBeenCalledTimes(1);
    });

    // 16. npcText input
    it('npcText input event calls npcService.updateNpcText with current value', () => {
        dom.npcText.value = 'Hello hero!';
        dom.npcText.dispatchEvent(new Event('input', { bubbles: true }));
        expect(npcService.updateNpcText).toHaveBeenCalledWith('Hello hero!');
    });

    // 16b. npcConditionalText input
    it('npcConditionalText input event calls npcService.updateNpcConditionalText with value', () => {
        dom.npcConditionalText.value = 'Conditional text';
        dom.npcConditionalText.dispatchEvent(new Event('input', { bubbles: true }));
        expect(npcService.updateNpcConditionalText).toHaveBeenCalledWith('Conditional text');
    });

    // 17. npcConditionalVariable change
    it('npcConditionalVariable change calls npcService.handleConditionVariableChange with value', () => {
        const option = document.createElement('option');
        option.value = 'var-quest';
        dom.npcConditionalVariable.appendChild(option);
        dom.npcConditionalVariable.value = 'var-quest';
        dom.npcConditionalVariable.dispatchEvent(new Event('change', { bubbles: true }));
        expect(npcService.handleConditionVariableChange).toHaveBeenCalledWith('var-quest');
    });

    // 17b. npcRewardVariable change
    it('npcRewardVariable change calls npcService.handleRewardVariableChange with value', () => {
        const option = document.createElement('option');
        option.value = 'var-gold';
        dom.npcRewardVariable.appendChild(option);
        dom.npcRewardVariable.value = 'var-gold';
        dom.npcRewardVariable.dispatchEvent(new Event('change', { bubbles: true }));
        expect(npcService.handleRewardVariableChange).toHaveBeenCalledWith('var-gold');
    });

    // 17c. npcConditionalRewardVariable change
    it('npcConditionalRewardVariable change calls npcService.handleConditionalRewardVariableChange', () => {
        const option = document.createElement('option');
        option.value = 'var-special';
        dom.npcConditionalRewardVariable.appendChild(option);
        dom.npcConditionalRewardVariable.value = 'var-special';
        dom.npcConditionalRewardVariable.dispatchEvent(new Event('change', { bubbles: true }));
        expect(npcService.handleConditionalRewardVariableChange).toHaveBeenCalledWith('var-special');
    });

    // 18. npcVariantButtons click with data-npc-variant-filter
    it('npcVariantButton click calls npcService.setVariantFilter with filter value', () => {
        dom.npcVariantButtons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(npcService.setVariantFilter).toHaveBeenCalledWith('hero');
    });

    it('npcVariantButton click with second button calls npcService.setVariantFilter with its value', () => {
        dom.npcVariantButtons[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(npcService.setVariantFilter).toHaveBeenCalledWith('villain');
    });

    it('npcVariantButton without data-npc-variant-filter does not call setVariantFilter', () => {
        // Not added to the array, this test validates the guard logic conceptually
        // We can test by removing the dataset from an existing button temporarily
        const originalFilter = dom.npcVariantButtons[0].dataset.npcVariantFilter;
        delete dom.npcVariantButtons[0].dataset.npcVariantFilter;

        // We need a fresh bind since the listeners are already registered with the dataset value captured at bind time
        // So we verify the guard: buttons bound without dataset attribute won't fire
        // Create a fresh svc with modified button
        vi.clearAllMocks();
        const built2 = makeManager();
        delete built2.dom.npcVariantButtons[0].dataset.npcVariantFilter;
        const svc2 = new EditorEventBinder(asEventBinderManager(built2.manager));
        svc2.bind();
        built2.dom.npcVariantButtons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(built2.npcService.setVariantFilter).not.toHaveBeenCalled();

        // Restore
        if (originalFilter) {
            dom.npcVariantButtons[0].dataset.npcVariantFilter = originalFilter;
        }
    });

    // 19. objectCategoryButtons click with data-object-category-filter
    it('objectCategoryButton click calls objectService.setCategoryFilter with category value', () => {
        dom.objectCategoryButtons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(objectService.setCategoryFilter).toHaveBeenCalledWith('items');
    });

    it('objectCategoryButton second button click passes its own filter value', () => {
        dom.objectCategoryButtons[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(objectService.setCategoryFilter).toHaveBeenCalledWith('props');
    });

    // 20. fileInput change
    it('fileInput change event calls shareService.loadGameFile with the event', () => {
        const changeEvent = new Event('change', { bubbles: true });
        dom.fileInput.dispatchEvent(changeEvent);
        expect(shareService.loadGameFile).toHaveBeenCalledTimes(1);
        expect(shareService.loadGameFile).toHaveBeenCalledWith(changeEvent);
    });

    // 21. tileList click on element with data-tile-id
    it('tileList click on [data-tile-id] element updates selectedTileId and calls render methods', () => {
        const tileBtn = document.createElement('button');
        tileBtn.dataset.tileId = '42';
        dom.tileList.appendChild(tileBtn);

        tileBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(manager.desselectAllAndRender).toHaveBeenCalledTimes(1);
        expect(manager.selectedTileId).toBe(42);
        expect(renderService.updateSelectedTilePreview).toHaveBeenCalledTimes(1);
        expect(renderService.renderTileList).toHaveBeenCalledTimes(1);
    });

    it('tileList click on element without data-tile-id does nothing', () => {
        const randomDiv = document.createElement('div');
        dom.tileList.appendChild(randomDiv);

        randomDiv.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(manager.desselectAllAndRender).not.toHaveBeenCalled();
        expect(manager.selectedTileId).toBeNull();
    });

    it('tileList click with placingObjectType calls objectService.togglePlacement before deselecting', () => {
        state.placingObjectType = 'chest';
        const tileBtn = document.createElement('button');
        tileBtn.dataset.tileId = '5';
        dom.tileList.appendChild(tileBtn);

        tileBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(objectService.togglePlacement).toHaveBeenCalledWith('chest', true);
        expect(manager.desselectAllAndRender).toHaveBeenCalled();
    });

    // 22. npcsList click on .npc-card → creates NPC if none in room
    it('npcsList click on .npc-card creates NPC and calls updateNpcSelection when no NPC in room', () => {
        const card = document.createElement('div');
        card.className = 'npc-card';
        card.dataset.type = 'hero';
        dom.npcsList.appendChild(card);

        gameEngine.getSprites.mockReturnValue([]);

        card.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(manager.desselectAllAndRender).toHaveBeenCalledTimes(1);
        expect(gameEngine.npcManager.createNPC).toHaveBeenCalledWith('hero', 0);
        expect(npcService.updateNpcSelection).toHaveBeenCalledWith('hero', 'npc-1');
    });

    it('npcsList click on .npc-card selects existing NPC when one is in the current room', () => {
        const card = document.createElement('div');
        card.className = 'npc-card';
        card.dataset.type = 'merchant';
        dom.npcsList.appendChild(card);

        gameEngine.getSprites.mockReturnValue([
            { id: 'existing-npc', type: 'merchant', roomIndex: 0, placed: true }
        ]);

        card.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(gameEngine.npcManager.createNPC).not.toHaveBeenCalled();
        expect(npcService.updateNpcSelection).toHaveBeenCalledWith('merchant', 'existing-npc');
    });

    it('npcsList click on non-.npc-card element does nothing', () => {
        const randomDiv = document.createElement('div');
        dom.npcsList.appendChild(randomDiv);

        randomDiv.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(manager.desselectAllAndRender).not.toHaveBeenCalled();
        expect(npcService.updateNpcSelection).not.toHaveBeenCalled();
    });

    // 23. objectTypes click on .object-type-card
    it('objectTypes click on .object-type-card calls objectService.selectObjectType', () => {
        const card = document.createElement('div');
        card.className = 'object-type-card';
        card.dataset.type = 'chest';
        dom.objectTypes.appendChild(card);

        card.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(manager.desselectAllAndRender).toHaveBeenCalledTimes(1);
        expect(objectService.selectObjectType).toHaveBeenCalledWith('chest');
    });

    it('objectTypes click on element without type does nothing', () => {
        const card = document.createElement('div');
        card.className = 'object-type-card';
        // No dataset.type
        dom.objectTypes.appendChild(card);

        card.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(objectService.selectObjectType).not.toHaveBeenCalled();
    });

    it('objectTypes click on non-card element does nothing', () => {
        const randomSpan = document.createElement('span');
        dom.objectTypes.appendChild(randomSpan);

        randomSpan.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(objectService.selectObjectType).not.toHaveBeenCalled();
    });

    // 24. objectsList click on .object-remove button inside .object-card
    it('objectsList click on .object-remove inside .object-card calls objectService.removeObject', () => {
        const card = document.createElement('div');
        card.className = 'object-card';
        card.dataset.type = 'barrel';
        card.dataset.roomIndex = '2';
        const removeBtn = document.createElement('button');
        removeBtn.className = 'object-remove';
        card.appendChild(removeBtn);
        dom.objectsList.appendChild(card);

        removeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(objectService.removeObject).toHaveBeenCalledWith('barrel', 2);
    });

    it('objectsList click on .object-remove without valid roomIndex does nothing', () => {
        const card = document.createElement('div');
        card.className = 'object-card';
        card.dataset.type = 'barrel';
        card.dataset.roomIndex = 'invalid';
        const removeBtn = document.createElement('button');
        removeBtn.className = 'object-remove';
        card.appendChild(removeBtn);
        dom.objectsList.appendChild(card);

        removeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(objectService.removeObject).not.toHaveBeenCalled();
    });

    it('objectsList click on element that is not .object-remove does nothing', () => {
        const card = document.createElement('div');
        card.className = 'object-card';
        const span = document.createElement('span');
        card.appendChild(span);
        dom.objectsList.appendChild(card);

        span.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(objectService.removeObject).not.toHaveBeenCalled();
    });

    // 25. enemyTypes click on .enemy-card
    it('enemyTypes click on .enemy-card calls enemyService.selectEnemyType', () => {
        const card = document.createElement('div');
        card.className = 'enemy-card';
        card.dataset.type = 'goblin';
        dom.enemyTypes.appendChild(card);

        card.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(manager.desselectAllAndRender).toHaveBeenCalledTimes(1);
        expect(enemyService.selectEnemyType).toHaveBeenCalledWith('goblin');
    });

    it('enemyTypes click on non-enemy-card element does nothing', () => {
        const div = document.createElement('div');
        dom.enemyTypes.appendChild(div);

        div.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(enemyService.selectEnemyType).not.toHaveBeenCalled();
    });

    // 26. enemiesList click on [data-remove-enemy]
    it('enemiesList click on [data-remove-enemy] calls enemyService.removeEnemy', () => {
        const btn = document.createElement('button');
        btn.dataset.removeEnemy = 'enemy-42';
        dom.enemiesList.appendChild(btn);

        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(enemyService.removeEnemy).toHaveBeenCalledWith('enemy-42');
    });

    it('enemiesList click on element without data-remove-enemy does nothing', () => {
        const btn = document.createElement('button');
        dom.enemiesList.appendChild(btn);

        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(enemyService.removeEnemy).not.toHaveBeenCalled();
    });

    it('enemiesList click on [data-remove-enemy] with empty value does nothing', () => {
        const btn = document.createElement('button');
        btn.dataset.removeEnemy = '';
        dom.enemiesList.appendChild(btn);

        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(enemyService.removeEnemy).not.toHaveBeenCalled();
    });

    // 27. enemiesList change on SELECT with data-enemy-variable
    it('enemiesList change on SELECT with data-enemy-variable calls enemyService.handleEnemyVariableChange', () => {
        const select = document.createElement('select');
        select.dataset.enemyVariable = 'enemy-99';
        const option = document.createElement('option');
        option.value = 'angry';
        select.appendChild(option);
        select.value = 'angry';
        dom.enemiesList.appendChild(select);

        select.dispatchEvent(new Event('change', { bubbles: true }));

        expect(enemyService.handleEnemyVariableChange).toHaveBeenCalledWith('enemy-99', 'angry');
    });

    it('enemiesList change on non-SELECT element does nothing', () => {
        const input = document.createElement('input');
        input.dataset.enemyVariable = 'enemy-99';
        dom.enemiesList.appendChild(input);

        input.dispatchEvent(new Event('change', { bubbles: true }));

        expect(enemyService.handleEnemyVariableChange).not.toHaveBeenCalled();
    });

    it('enemiesList change on SELECT without data-enemy-variable does nothing', () => {
        const select = document.createElement('select');
        dom.enemiesList.appendChild(select);

        select.dispatchEvent(new Event('change', { bubbles: true }));

        expect(enemyService.handleEnemyVariableChange).not.toHaveBeenCalled();
    });

    // 28. worldGrid click on [data-room-index]
    it('worldGrid click on [data-room-index] calls worldService.setActiveRoom with numeric index', () => {
        const cell = document.createElement('div');
        cell.dataset.roomIndex = '5';
        dom.worldGrid.appendChild(cell);

        cell.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(worldService.setActiveRoom).toHaveBeenCalledWith(5);
    });

    it('worldGrid click on element without data-room-index does nothing', () => {
        const div = document.createElement('div');
        dom.worldGrid.appendChild(div);

        div.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(worldService.setActiveRoom).not.toHaveBeenCalled();
    });

    // 29. mapNavButtons click with data-direction
    it('mapNavButton click calls worldService.moveActiveRoom with direction', () => {
        dom.mapNavButtons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(worldService.moveActiveRoom).toHaveBeenCalledWith('north');
    });

    it('mapNavButton second button click passes its direction value', () => {
        dom.mapNavButtons[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(worldService.moveActiveRoom).toHaveBeenCalledWith('south');
    });

    it('mapNavButton without data-direction does not call moveActiveRoom', () => {
        const built2 = makeManager();
        delete built2.dom.mapNavButtons[0].dataset.direction;
        const svc2 = new EditorEventBinder(asEventBinderManager(built2.manager));
        svc2.bind();
        built2.dom.mapNavButtons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(built2.worldService.moveActiveRoom).not.toHaveBeenCalled();
    });

    // 30. editorCanvas pointerdown
    it('editorCanvas pointerdown calls tileService.startPaint with pointer event', () => {
        // jsdom does not expose a PointerEvent constructor; use a plain Event and verify the handler fires
        const pev = new Event('pointerdown', { bubbles: true });
        dom.editorCanvas.dispatchEvent(pev);
        expect(tileService.startPaint).toHaveBeenCalledTimes(1);
        expect(tileService.startPaint).toHaveBeenCalledWith(pev);
    });

    // 31. editorCanvas pointermove
    it('editorCanvas pointermove calls tileService.continuePaint with pointer event', () => {
        const pev = new Event('pointermove', { bubbles: true });
        dom.editorCanvas.dispatchEvent(pev);
        expect(tileService.continuePaint).toHaveBeenCalledTimes(1);
        expect(tileService.continuePaint).toHaveBeenCalledWith(pev);
    });

    // 32. globalThis pointerup
    it('globalThis pointerup calls tileService.finishPaint with the event', () => {
        const pev = new Event('pointerup', { bubbles: true });
        window.dispatchEvent(pev);
        expect(tileService.finishPaint).toHaveBeenCalledTimes(1);
        expect(tileService.finishPaint).toHaveBeenCalledWith(pev);
    });

    // 33. mobileNavButtons click with data-mobile-target
    it('mobileNavButton click calls manager.setActiveMobilePanel with target', () => {
        dom.mobileNavButtons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(manager.setActiveMobilePanel).toHaveBeenCalledWith('map');
    });

    it('mobileNavButton second button click passes its own target', () => {
        dom.mobileNavButtons[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(manager.setActiveMobilePanel).toHaveBeenCalledWith('npcs');
    });

    it('mobileNavButton without data-mobile-target does not call setActiveMobilePanel', () => {
        const built2 = makeManager();
        delete built2.dom.mobileNavButtons[0].dataset.mobileTarget;
        const svc2 = new EditorEventBinder(asEventBinderManager(built2.manager));
        svc2.bind();
        built2.dom.mobileNavButtons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(built2.manager.setActiveMobilePanel).not.toHaveBeenCalled();
    });

    // 34. document keydown
    it('document keydown calls manager.handleKey with the keyboard event', () => {
        const kev = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
        document.dispatchEvent(kev);
        expect(manager.handleKey).toHaveBeenCalledWith(kev);
    });

    it('document keydown calls manager.handleKey for any key', () => {
        const kev = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true });
        document.dispatchEvent(kev);
        expect(manager.handleKey).toHaveBeenCalledWith(kev);
    });

    // 35. globalThis resize
    it('globalThis resize calls manager.handleCanvasResize and manager.updateMobilePanels', () => {
        window.dispatchEvent(new Event('resize'));
        expect(manager.handleCanvasResize).toHaveBeenCalledTimes(1);
        expect(manager.updateMobilePanels).toHaveBeenCalledTimes(1);
    });

    // projectTestSkillList change - skill checkbox
    it('projectTestSkillList change on INPUT calls manager.setTestSkills with checked skill IDs', () => {
        // The checkboxes were created in makeDom: skill-fire (checked), skill-ice (unchecked)
        const skillCheckbox = dom.projectTestSkillList.querySelector('input[data-skill-id="skill-fire"]') as HTMLInputElement;
        skillCheckbox.checked = true;

        skillCheckbox.dispatchEvent(new Event('change', { bubbles: true }));

        expect(manager.setTestSkills).toHaveBeenCalledWith(['skill-fire']);
    });

    it('projectTestSkillList change on non-INPUT element does nothing', () => {
        const span = document.createElement('span');
        dom.projectTestSkillList.appendChild(span);

        span.dispatchEvent(new Event('change', { bubbles: true }));

        expect(manager.setTestSkills).not.toHaveBeenCalled();
    });

    it('projectTestSkillList change includes all checked skill IDs', () => {
        const checkboxes = dom.projectTestSkillList.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
        checkboxes.forEach(cb => { cb.checked = true; });

        checkboxes[0].dispatchEvent(new Event('change', { bubbles: true }));

        expect(manager.setTestSkills).toHaveBeenCalledWith(['skill-fire', 'skill-ice']);
    });

    // Additional edge case: tileList click via nested child element
    it('tileList click on child of [data-tile-id] resolves the closest ancestor', () => {
        const tileBtn = document.createElement('button');
        tileBtn.dataset.tileId = '7';
        const inner = document.createElement('span');
        tileBtn.appendChild(inner);
        dom.tileList.appendChild(tileBtn);

        inner.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(manager.selectedTileId).toBe(7);
        expect(renderService.updateSelectedTilePreview).toHaveBeenCalled();
    });

    // Additional edge case: objectTypes click on child of .object-type-card
    it('objectTypes click on child inside .object-type-card resolves via closest', () => {
        const card = document.createElement('div');
        card.className = 'object-type-card';
        card.dataset.type = 'door';
        const inner = document.createElement('span');
        card.appendChild(inner);
        dom.objectTypes.appendChild(card);

        inner.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(objectService.selectObjectType).toHaveBeenCalledWith('door');
    });

    // Additional edge case: enemyTypes click on child of .enemy-card
    it('enemyTypes click on child inside .enemy-card resolves via closest', () => {
        const card = document.createElement('div');
        card.className = 'enemy-card';
        card.dataset.type = 'troll';
        const inner = document.createElement('span');
        card.appendChild(inner);
        dom.enemyTypes.appendChild(card);

        inner.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(enemyService.selectEnemyType).toHaveBeenCalledWith('troll');
    });

    // Additional edge case: worldGrid click on child of [data-room-index]
    it('worldGrid click on child inside [data-room-index] resolves via closest', () => {
        const cell = document.createElement('div');
        cell.dataset.roomIndex = '3';
        const inner = document.createElement('span');
        cell.appendChild(inner);
        dom.worldGrid.appendChild(cell);

        inner.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(worldService.setActiveRoom).toHaveBeenCalledWith(3);
    });

    // Edge case: npcsList click on .npc-card without a type (empty dataset)
    it('npcsList click on .npc-card without type does not call createNPC', () => {
        const card = document.createElement('div');
        card.className = 'npc-card';
        // No dataset.type set
        dom.npcsList.appendChild(card);

        gameEngine.getSprites.mockReturnValue([]);

        card.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(manager.desselectAllAndRender).toHaveBeenCalledTimes(1);
        expect(gameEngine.npcManager.createNPC).not.toHaveBeenCalled();
        expect(npcService.updateNpcSelection).not.toHaveBeenCalled();
    });
});


