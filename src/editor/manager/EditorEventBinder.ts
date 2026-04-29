import type { EditorManager } from '../EditorManager';
import { EditorManagerModule } from './EditorManagerModule';
import { DebugFlags } from '../../runtime/debug/DebugFlags';
import type { CustomSpriteEntry, CustomSpriteVariant } from '../../types/gameState';

class EditorEventBinder extends EditorManagerModule {
    declare manager: EditorManager;
    bind() {
        const {
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
            projectTabButtons,
            projectSkillsToggle,
            projectTestStartLevel,
            projectTestSkillList,
            projectTestGodMode,
            projectTestDebugVision,
            projectHideHud,
            projectDisableSkills,
            projectDisablePixelFont,
            shareUrlInput
        } = this.dom;

        const manager = this.manager;
        const npcService = manager.npcService;
        const enemyService = manager.enemyService;
        const objectService = manager.objectService;
        const shareService = manager.shareService;
        const tileService = manager.tileService;
        const worldService = manager.worldService;

        btnNpcDelete?.addEventListener('click', () => npcService.removeSelectedNpc());
        btnToggleNpcConditional?.addEventListener('click', () => {
            this.state.conditionalDialogueExpanded = !this.state.conditionalDialogueExpanded;
            this.renderService.updateNpcForm();
        });

        btnGenerateUrl?.addEventListener('click', () => void shareService.generateShareableUrl());
        btnUndo?.addEventListener('click', () => manager.undo());
        btnRedo?.addEventListener('click', () => manager.redo());
        projectVariablesToggle?.addEventListener('click', () => manager.toggleVariablePanel());
        if (Array.isArray(projectTabButtons)) {
            projectTabButtons.forEach((button) => {
                button.addEventListener('click', () => {
                    const tab = button.dataset.projectTabButton;
                    if (!tab) return;
                    manager.uiController.setActiveProjectTab(tab);
                });
            });
        }
        projectSkillsToggle?.addEventListener('click', () => manager.toggleSkillPanel());
        this.dom.projectSkillsResetOrder?.addEventListener('click', () => manager.resetSkillOrder());

        titleInput?.addEventListener('input', () => manager.updateGameMetadata());
        authorInput?.addEventListener('input', () => manager.updateGameMetadata());
        projectTestStartLevel?.addEventListener('change', (ev: Event) => {
            const target = ev.target as HTMLSelectElement;
            const value = Number(target.value);
            manager.setTestStartLevel(value);
        });
        projectTestGodMode?.addEventListener('change', (ev: Event) => {
            const target = ev.target as HTMLInputElement;
            manager.setGodMode(target.checked);
        });
        projectTestDebugVision?.addEventListener('change', (ev: Event) => {
            const target = ev.target as HTMLInputElement;
            DebugFlags.setEnemyVision(target.checked);
        });
        projectHideHud?.addEventListener('change', (ev: Event) => {
            const target = ev.target as HTMLInputElement;
            manager.setHideHud(target.checked);
        });
        projectDisableSkills?.addEventListener('change', (ev: Event) => {
            const target = ev.target as HTMLInputElement;
            manager.setDisableSkills(target.checked);
        });
        projectDisablePixelFont?.addEventListener('change', (ev: Event) => {
            const target = ev.target as HTMLInputElement;
            manager.setDisablePixelFont(target.checked);
        });
        shareUrlInput?.addEventListener('focus', () => shareUrlInput.select());
        shareUrlInput?.addEventListener('click', () => shareUrlInput.select());
        projectTestSkillList?.addEventListener('change', (ev: Event) => {
            const target = ev.target as HTMLElement;
            if (target.tagName !== 'INPUT') return;
            const skills = Array.from(projectTestSkillList.querySelectorAll('input[type="checkbox"][data-skill-id]'))
                .filter((input) => (input as HTMLInputElement).checked)
                .map((input) => (input as HTMLInputElement).dataset.skillId)
                .filter(Boolean) as string[];
            manager.setTestSkills(skills);
        });
        npcText?.addEventListener('input', () => npcService.updateNpcText(npcText.value));
        npcConditionalText?.addEventListener('input', () => npcService.updateNpcConditionalText(npcConditionalText.value));
        npcConditionalVariable?.addEventListener('change', (ev: Event) => npcService.handleConditionVariableChange((ev.target as HTMLSelectElement).value));
        npcRewardVariable?.addEventListener('change', (ev: Event) => npcService.handleRewardVariableChange((ev.target as HTMLSelectElement).value));
        npcConditionalRewardVariable?.addEventListener('change', (ev: Event) => npcService.handleConditionalRewardVariableChange((ev.target as HTMLSelectElement).value));
        if (Array.isArray(npcVariantButtons)) {
            npcVariantButtons.forEach((button) => {
                button.addEventListener('click', () => {
                    const variant = button.dataset.npcVariantFilter;
                    if (!variant) return;
                    npcService.setVariantFilter(variant);
                });
            });
        }

        if (Array.isArray(objectCategoryButtons)) {
            objectCategoryButtons.forEach((button) => {
                button.addEventListener('click', () => {
                    const category = button.dataset.objectCategoryFilter;
                    if (!category) return;
                    objectService.setCategoryFilter(category);
                });
            });
        }

        fileInput?.addEventListener('change', (ev: Event) => shareService.loadGameFile(ev));

        tileList?.addEventListener('click', (ev: Event): void => {
            const target = ev.target as HTMLElement;

            // Handle sprite edit button - must come before tile selection
            const editBtn = target.closest('.sprite-edit-btn') as HTMLElement | null;
            if (editBtn) {
                ev.preventDefault();
                ev.stopPropagation();
                const group = editBtn.dataset.editGroup as CustomSpriteEntry['group'];
                const key = editBtn.dataset.editKey || '';
                const variant = (editBtn.dataset.editVariant as CustomSpriteVariant | undefined) || 'base';
                manager.pixelArtEditorController.open(group, key, variant);
                return;
            }

            const button = target.closest('[data-tile-id]') as HTMLElement | null;
            if (!button) return;
            const tileId = Number(button.dataset.tileId);
            if (!Number.isFinite(tileId)) return;
            if (this.state.placingObjectType) {
                objectService.togglePlacement(this.state.placingObjectType, true);
            }

            manager.desselectAllAndRender();

            manager.selectedTileId = tileId;
            this.renderService.updateSelectedTilePreview();
            this.renderService.renderTileList();
        });

        npcsList?.addEventListener('click', (ev: Event) => {
            const target = ev.target as HTMLElement;

            const editBtn = target.closest('.sprite-edit-btn') as HTMLElement | null;
            if (editBtn) {
                ev.preventDefault();
                ev.stopPropagation();
                const group = editBtn.dataset.editGroup as CustomSpriteEntry['group'];
                const key = editBtn.dataset.editKey || '';
                const variant = (editBtn.dataset.editVariant as CustomSpriteVariant | undefined) || 'base';
                manager.pixelArtEditorController.open(group, key, variant);
                return;
            }

            const card = target.closest('.npc-card') as HTMLElement | null;
            if (!card) return;
            const type = card.dataset.type || null;

            manager.desselectAllAndRender();

            const currentRoom = manager.state.activeRoomIndex;
            const sprites = manager.gameEngine.getSprites() as { id: string; type: string; roomIndex: number; placed?: boolean }[];
            const npcInCurrentRoom = sprites.find(n => n.type === type && n.roomIndex === currentRoom);

            if (!npcInCurrentRoom && type) {
                const manager_typed = manager.gameEngine.npcManager as { createNPC?: (type: string, roomIndex?: number) => unknown };
                const created = manager_typed.createNPC ? manager_typed.createNPC(type, currentRoom) : null;
                if (created && typeof created === 'object' && 'id' in created && 'type' in created) {
                    npcService.updateNpcSelection(created.type as string, created.id as string);
                }
            } else if (npcInCurrentRoom) {
                npcService.updateNpcSelection(type, npcInCurrentRoom.id);
            }
        });

        objectTypes?.addEventListener('click', (ev: Event) => {
            const target = ev.target as HTMLElement;

            const editBtn = target.closest('.sprite-edit-btn') as HTMLElement | null;
            if (editBtn) {
                ev.preventDefault();
                ev.stopPropagation();
                const group = editBtn.dataset.editGroup as CustomSpriteEntry['group'];
                const key = editBtn.dataset.editKey || '';
                const variant = (editBtn.dataset.editVariant as CustomSpriteVariant | undefined) || 'base';
                manager.pixelArtEditorController.open(group, key, variant);
                return;
            }

            const card = target.closest('.object-type-card') as HTMLElement | null;
            if (!card) return;
            const type = card.dataset.type || null;
            if (!type) return;

            manager.desselectAllAndRender();
            objectService.selectObjectType(type);
        });

        objectsList?.addEventListener('click', (ev: Event) => {
            const target = ev.target as HTMLElement;

            const editBtn = target.closest('.sprite-edit-btn') as HTMLElement | null;
            if (editBtn) {
                ev.preventDefault();
                ev.stopPropagation();
                const group = editBtn.dataset.editGroup as CustomSpriteEntry['group'];
                const key = editBtn.dataset.editKey || '';
                const variant = (editBtn.dataset.editVariant as CustomSpriteVariant | undefined) || 'base';
                manager.pixelArtEditorController.open(group, key, variant);
                return;
            }

            const button = target.closest('.object-remove') as HTMLElement | null;
            if (!button) return;
            const card = button.closest('.object-card') as HTMLElement | null;
            if (!card) return;
            const type = card.dataset.type;
            const room = Number(card.dataset.roomIndex);
            if (!type || !Number.isFinite(room)) return;
            objectService.removeObject(type, room);
        });

        enemyTypes?.addEventListener('click', (ev: Event) => {
            const target = ev.target as HTMLElement;

            const editBtn = target.closest('.sprite-edit-btn') as HTMLElement | null;
            if (editBtn) {
                ev.preventDefault();
                ev.stopPropagation();
                const group = editBtn.dataset.editGroup as CustomSpriteEntry['group'];
                const key = editBtn.dataset.editKey || '';
                const variant = (editBtn.dataset.editVariant as CustomSpriteVariant | undefined) || 'base';
                manager.pixelArtEditorController.open(group, key, variant);
                return;
            }

            const card = target.closest('.enemy-card') as HTMLElement | null;
            if (!card) return;
            const type = card.dataset.type || null;
            if (!type) return;

            manager.desselectAllAndRender();
            enemyService.selectEnemyType(type);
        });

        enemiesList?.addEventListener('click', (ev: Event) => {
            const target = ev.target as HTMLElement;
            const button = target.closest('[data-remove-enemy]') as HTMLElement | null;
            if (!button) return;
            const enemyId = button.dataset.removeEnemy;
            if (!enemyId) return;
            enemyService.removeEnemy(enemyId);
        });

        enemiesList?.addEventListener('change', (ev: Event) => {
            const target = ev.target as HTMLSelectElement;
            if (target.tagName !== 'SELECT') return;
            const enemyId = target.dataset.enemyVariable;
            if (!enemyId) return;
            const value = target.value || '';
            enemyService.handleEnemyVariableChange(enemyId, value);
        });

        worldGrid?.addEventListener('click', (ev: Event) => {
            const target = ev.target as HTMLElement;
            const cell = target.closest('[data-room-index]') as HTMLElement | null;
            if (!cell) return;
            const index = Number(cell.dataset.roomIndex);
            worldService.setActiveRoom(index);
        });

        if (Array.isArray(mapNavButtons)) {
            mapNavButtons.forEach((button) => {
                button.addEventListener('click', () => {
                    const direction = button.dataset.direction;
                    if (!direction) return;
                    worldService.moveActiveRoom(direction);
                });
            });
        }

        if (editorCanvas) {
            editorCanvas.addEventListener('pointerdown', (ev: PointerEvent) => tileService.startPaint(ev));
            editorCanvas.addEventListener('pointermove', (ev: PointerEvent) => tileService.continuePaint(ev));
        }

        if (Array.isArray(mobileNavButtons)) {
            mobileNavButtons.forEach((button) => {
                button.addEventListener('click', () => {
                    const target = button.dataset.mobileTarget;
                    if (!target) return;
                    manager.setActiveMobilePanel(target);
                });
            });
        }

        document.addEventListener('keydown', (ev: KeyboardEvent) => manager.handleKey(ev));
        globalThis.addEventListener('resize', () => {
            manager.handleCanvasResize();
            manager.updateMobilePanels();
        });
        document.addEventListener('editor-tab-activated', () =>
            requestAnimationFrame(() => {
                manager.handleCanvasResize(true);
                manager.updateMobilePanels();
            })
        );

        globalThis.addEventListener('pointerup', (ev) => tileService.finishPaint(ev));
    }
}

export { EditorEventBinder };
