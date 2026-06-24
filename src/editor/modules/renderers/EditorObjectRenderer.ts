
import { StateObjectManager } from '../../../runtime/domain/state/StateObjectManager';
import { ITEM_TYPES, type ItemType } from '../../../runtime/domain/constants/itemTypes';
import { ItemDefinitions } from '../../../runtime/domain/definitions/ItemDefinitions';
import { itemCatalog } from '../../../runtime/domain/services/ItemCatalog';
import { EditorConstants } from '../EditorConstants';
import { EditorRendererBase } from './EditorRendererBase';
import { RendererConstants } from '../../../runtime/adapters/renderer/RendererConstants';
import { CustomSpriteLookup } from '../../../runtime/domain/sprites/CustomSpriteLookup';
import type { CustomSpriteEntry } from '../../../types/gameState';
import { ONLINE_PLAYER_START_2_TYPE } from '../EditorObjectService';

const EditorObjectTypes = ITEM_TYPES;
const PLAYER_END_TYPE = EditorObjectTypes.PLAYER_END;
const DOOR_VARIABLE_TYPE = EditorObjectTypes.DOOR_VARIABLE;

type ObjectDefinitionView = {
    type: string;
    name?: string;
    nameKey?: string;
};

type EditorObject = {
    id?: string;
    type: string;
    roomIndex: number;
    x: number;
    y: number;
    variableId?: string | null;
    on?: boolean;
    opened?: boolean;
    collected?: boolean;
    endingText?: string;
    inputVariableId?: string | null;
    inputVariableId2?: string | null;
    outputVariableId?: string | null;
    isLogicGate?: boolean;
    isSingleInputGate?: boolean;
    isLed?: boolean;
    hiddenInGame?: boolean;
};

class EditorObjectRenderer extends EditorRendererBase {
    renderObjectCatalog(): void {
        const container = this.dom.objectTypes;
        if (!container) return;
        container.innerHTML = '';

        this.manager.objectService.updateCategoryButtons();

        const definitions = EditorConstants.OBJECT_DEFINITIONS as ObjectDefinitionView[];
        if (!Array.isArray(definitions) || !definitions.length) return;
        const game = (this.gameEngine as unknown as { getGame?(): { customSprites?: CustomSpriteEntry[]; online?: { enabled?: boolean; spawnPoints?: Array<{ role: string; roomIndex: number; x: number; y: number }> } } }).getGame?.();
        const onlineEnabled = Boolean(game?.online?.enabled);
        const catalogDefinitions = onlineEnabled
            ? (() => {
                const playerStart = definitions.find((def) => def.type === EditorObjectTypes.PLAYER_START);
                const remaining = definitions.filter((def) => def.type !== EditorObjectTypes.PLAYER_START);
                return [
                    ...(playerStart ? [{ ...playerStart, nameKey: 'objects.label.playerStart1' }] : []),
                    { type: ONLINE_PLAYER_START_2_TYPE, nameKey: 'objects.label.playerStart2' },
                    ...remaining,
                ];
            })()
            : definitions;

        const categoryFilter = this.state.objectCategoryFilter || 'all';
        const filteredDefinitions = catalogDefinitions.filter((def) => {
            if (def.type === ONLINE_PLAYER_START_2_TYPE) {
                return categoryFilter === 'all' || categoryFilter === 'markers';
            }
            if (categoryFilter === 'all') return true;
            const itemDef = ItemDefinitions.getItemDefinition(def.type as ItemType);
            return Boolean(itemDef && itemDef.hasTag(categoryFilter));
        });

        const selectedType = this.manager.selectedObjectType;
        const placedObjects = (this.gameEngine.getObjectsForRoom(this.state.activeRoomIndex) || []) as EditorObject[];
        // Global-unique objects (e.g. player-start) must be detected across all rooms.
        const allObjects = ((this.gameEngine as unknown as { getObjects?(): EditorObject[] }).getObjects?.() || []) as EditorObject[];
        const allPlacedTypes = new Set(allObjects.map((o) => o.type));
        const placedTypes = new Set(placedObjects.map((object) => object.type));
        const customSprites = game?.customSprites;
        const rendererDefs = (RendererConstants.OBJECT_DEFINITIONS as Array<{ type: string; spriteOn?: unknown }> | undefined) ?? [];

        filteredDefinitions.forEach((definition) => {
            const card = document.createElement('div');
            card.className = 'object-type-card';
            card.dataset.type = definition.type;
            if (definition.type === selectedType) {
                card.classList.add('selected');
            }
            // Use allPlacedTypes for global-unique objects so they appear as placed
            // even when the current room is different from the room they're in.
            const isPlayerStart2 = definition.type === ONLINE_PLAYER_START_2_TYPE;
            const isGlobalUnique = definition.type === EditorObjectTypes.PLAYER_START || isPlayerStart2;
            const isMulti = isPlayerStart2 ? false : itemCatalog.allowsMultiplePerRoom(definition.type as ItemType);
            const instanceCount = isPlayerStart2 ? 0 : placedObjects.filter((o) => o.type === definition.type).length;
            const hasPlayerStart2 = Boolean(game?.online?.spawnPoints?.some((spawn) => spawn.role === 'p2'));
            const isPlaced = isMulti
                ? instanceCount >= StateObjectManager.MULTI_INSTANCE_LIMIT
                : (isPlayerStart2 ? hasPlayerStart2 : (isGlobalUnique ? allPlacedTypes.has(definition.type) : placedTypes.has(definition.type)));
            if (isPlaced) {
                card.classList.add('placed');
            }

            const preview = document.createElement('canvas');
            preview.width = 48;
            preview.height = 48;
            preview.className = 'object-type-preview';
            this.drawObjectPreview(preview, definition.type);

            const meta = document.createElement('div');
            meta.className = 'object-type-meta';

            const name = document.createElement('div');
            name.className = 'object-type-name';
            name.textContent = this.getObjectLabel(definition.type, catalogDefinitions);

            const info = document.createElement('div');
            info.className = 'object-type-info';
            const infoPlacedKey = isGlobalUnique ? 'objects.info.placed.global' : 'objects.info.placed';
            const infoAvailableKey = isGlobalUnique ? 'objects.info.available.global' : 'objects.info.available';
            if (isMulti) {
                info.textContent = this.tf('objects.info.count', {
                    count: instanceCount,
                    max: StateObjectManager.MULTI_INSTANCE_LIMIT
                });
            } else {
                info.textContent = isPlaced
                    ? this.t(infoPlacedKey)
                    : this.t(infoAvailableKey);
            }

            meta.append(name, info);

            // Add sword stats (durability and damage) if it's a sword
            const itemDef = ItemDefinitions.getItemDefinition(definition.type as ItemType);
            if (itemDef && itemDef.hasTag('sword')) {
                const durability = itemDef.getSwordDurability();
                const damage = itemDef.getSwordDamage();

                if (durability !== null || damage !== null) {
                    const stats = document.createElement('div');
                    stats.className = 'object-type-stats';
                    if (damage !== null) {
                        const damageSpan = document.createElement('span');
                        damageSpan.className = 'object-stat-damage';
                        damageSpan.textContent = this.tf('editor.object.attackBadge', { value: damage }, `ATK: ${damage}`);
                        stats.appendChild(damageSpan);
                    }

                    if (durability !== null && damage !== null) {
                        const separator = document.createElement('span');
                        separator.className = 'object-stat-separator';
                        separator.textContent = ' - ';
                        stats.appendChild(separator);
                    }

                    if (durability !== null) {
                        const durabilitySpan = document.createElement('span');
                        durabilitySpan.className = 'object-stat-durability';
                        durabilitySpan.textContent = this.tf('editor.object.defenseBadge', { value: durability }, `DEF: ${durability}`);
                        stats.appendChild(durabilitySpan);
                    }

                    meta.appendChild(stats);
                }
            }

            const isPlayerStart = definition.type === EditorObjectTypes.PLAYER_START || isPlayerStart2;
            const rendererDef = isPlayerStart
                ? undefined
                : rendererDefs.find((d) => d.type === definition.type);
            const hasSpriteOn = Boolean(rendererDef?.spriteOn);

            card.append(preview, meta);
            if (!isPlayerStart2) {
                const editBtn = document.createElement('button');
                editBtn.type = 'button';
                editBtn.className = 'sprite-edit-btn';
                editBtn.dataset.editGroup = isPlayerStart ? 'player' : 'object';
                editBtn.dataset.editKey = isPlayerStart ? 'default' : definition.type;
                editBtn.dataset.editVariant = 'base';
                editBtn.textContent = '✎';

                const isCustom = isPlayerStart
                    ? CustomSpriteLookup.find(customSprites, 'player', 'default', 'base') !== null
                    : this.hasCustomSprite(customSprites, definition.type, hasSpriteOn);
                if (isCustom) editBtn.classList.add('is-custom');
                card.appendChild(editBtn);
            }

            container.appendChild(card);
        });
    }

    renderObjects(): void {
        const container = this.dom.objectsList;
        if (!container) return;
        container.innerHTML = '';

        const objects = (this.gameEngine.getObjectsForRoom(this.state.activeRoomIndex) ||
            []) as EditorObject[];
        const definitions = EditorConstants.OBJECT_DEFINITIONS as ObjectDefinitionView[];

        objects.forEach((object: EditorObject) => {
            const card = document.createElement('div');
            card.className = 'object-card';
            card.dataset.type = object.type;
            card.dataset.roomIndex = String(object.roomIndex);
            if (object.id) card.dataset.objectId = object.id;

            const preview = document.createElement('canvas');
            preview.className = 'object-preview';
            preview.width = 48;
            preview.height = 48;
            this.drawObjectPreview(preview, object.type);

            const body = document.createElement('div');
            body.className = 'object-body';

            const header = document.createElement('div');
            header.className = 'object-header';

            const title = document.createElement('h4');
            title.className = 'object-name';
            title.textContent = this.getObjectLabel(object.type, definitions);
            header.appendChild(title);

            const position = document.createElement('span');
            position.className = 'object-position';
            position.textContent = `(${object.x}, ${object.y})`;
            header.appendChild(position);

            body.appendChild(header);
            body.appendChild(this.buildObjectConfigArea(object));

            if (object.type !== EditorObjectTypes.PLAYER_START) {
                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'object-remove';
                removeBtn.dataset.type = object.type;
                removeBtn.dataset.roomIndex = String(object.roomIndex);
                if (object.id) removeBtn.dataset.objectId = object.id;
                removeBtn.textContent = this.t('buttons.remove');
                body.appendChild(removeBtn);
            } else {
                const badge = document.createElement('div');
                badge.className = 'object-status';
                badge.textContent = this.t('objects.status.startMarker');
                body.appendChild(badge);

                const game = (this.gameEngine as unknown as { getGame?(): { customSprites?: CustomSpriteEntry[] } }).getGame?.();
                const editBtn = document.createElement('button');
                editBtn.type = 'button';
                editBtn.className = 'sprite-edit-btn';
                editBtn.dataset.editGroup = 'player';
                editBtn.dataset.editKey = 'default';
                editBtn.dataset.editVariant = 'base';
                editBtn.textContent = '✎';
                if (CustomSpriteLookup.find(game?.customSprites, 'player', 'default', 'base') !== null) {
                    editBtn.classList.add('is-custom');
                }
                body.appendChild(editBtn);
            }

            card.append(preview, body);
            container.appendChild(card);
        });
    }

    buildObjectConfigArea(object: EditorObject, onAfterChange?: () => void): HTMLElement {
        const wrapper = document.createElement('div');
        wrapper.className = 'object-config-area';

        const refresh = () => {
            this.renderObjects();
            this.service.worldRenderer.renderWorldGrid();
            this.service.renderEditor();
            this.manager.updateJSON();
            this.manager.history.pushCurrentState();
            onAfterChange?.();
        };

        if (object.type === EditorObjectTypes.SWITCH || object.type === DOOR_VARIABLE_TYPE) {
            const config = document.createElement('div');
            config.className = 'object-config';

            const label = document.createElement('label');
            label.className = 'object-config-label';

            const select = document.createElement('select');
            select.className = 'object-config-select';
            this.manager.npcService.populateVariableSelect(select, object.variableId || '');
            select.addEventListener('change', () => {
                this.gameEngine.setObjectVariableById(object.id ?? '', select.value);
                refresh();
            });
            label.append(`${this.t('objects.switch.variableLabel')} `, select);
            config.appendChild(label);

            const status = document.createElement('div');
            status.className = 'object-status';
            const isOn = object.type === EditorObjectTypes.SWITCH
                ? Boolean(object.on)
                : Boolean(this.gameEngine.isVariableOn(object.variableId || ''));
            status.textContent = this.tf('objects.switch.stateLabel', {
                state: isOn ? this.t('objects.state.on') : this.t('objects.state.off')
            });
            config.appendChild(status);

            wrapper.appendChild(config);
        }

        if (object.isLogicGate) {
            wrapper.appendChild(this.buildLogicGateConfig(object, refresh));
        }

        if (object.type === EditorObjectTypes.TRAP) {
            const config = document.createElement('div');
            config.className = 'object-config';

            const label = document.createElement('label');
            label.className = 'object-config-label';

            const select = document.createElement('select');
            select.className = 'object-config-select';
            this.manager.npcService.populateVariableSelect(select, object.variableId || '');
            select.addEventListener('change', () => {
                this.gameEngine.setObjectVariableById(object.id ?? '', select.value);
                refresh();
            });
            label.append(`${this.t('objects.switch.variableLabel')} `, select);
            config.appendChild(label);

            const status = document.createElement('div');
            status.className = 'object-status';
            const isActiveTrap = Boolean(this.gameEngine.isVariableOn(object.variableId || ''));
            status.textContent = this.tf('objects.switch.stateLabel', {
                state: isActiveTrap ? this.t('objects.state.on') : this.t('objects.state.off')
            });
            config.appendChild(status);
            wrapper.appendChild(config);
        }

        if (object.type === EditorObjectTypes.PRESSURE_PLATE) {
            const config = document.createElement('div');
            config.className = 'object-config';

            const label = document.createElement('label');
            label.className = 'object-config-label';

            const select = document.createElement('select');
            select.className = 'object-config-select';
            this.manager.npcService.populateVariableSelect(select, object.variableId || '');
            select.addEventListener('change', () => {
                this.gameEngine.setObjectVariableById(object.id ?? '', select.value);
                refresh();
            });
            label.append(`${this.t('objects.switch.variableLabel')} `, select);
            config.appendChild(label);

            const status = document.createElement('div');
            status.className = 'object-status';
            const isActivePlate = Boolean(this.gameEngine.isVariableOn(object.variableId || ''));
            status.textContent = this.tf('objects.switch.stateLabel', {
                state: isActivePlate ? this.t('objects.state.on') : this.t('objects.state.off')
            });
            config.appendChild(status);
            wrapper.appendChild(config);
        }

        if (object.type === EditorObjectTypes.CHEST) {
            const config = document.createElement('div');
            config.className = 'object-config';

            const isRandom = Boolean((object as Record<string, unknown>).randomItem);

            const selectLabel = document.createElement('label');
            selectLabel.className = 'object-config-label';

            const select = document.createElement('select');
            select.className = 'object-config-select';
            select.disabled = isRandom;

            const chestItemTypes: Array<{ value: string; labelKey: string }> = [
                { value: '', labelKey: 'objects.chest.noItem' },
                { value: EditorObjectTypes.KEY, labelKey: 'objects.label.key' },
                { value: EditorObjectTypes.LIFE_POTION, labelKey: 'objects.label.lifePotion' },
                { value: EditorObjectTypes.XP_SCROLL, labelKey: 'objects.label.xpScroll' },
                { value: EditorObjectTypes.SWORD_WOOD, labelKey: 'objects.label.swordWood' },
                { value: EditorObjectTypes.SWORD_BRONZE, labelKey: 'objects.label.swordBronze' },
                { value: EditorObjectTypes.SWORD, labelKey: 'objects.label.sword' },
                { value: EditorObjectTypes.ARMOR, labelKey: 'objects.label.armor' },
                { value: EditorObjectTypes.BOOTS, labelKey: 'objects.label.boots' },
            ];
            const currentContains = (object as Record<string, unknown>).containsItemType as string | null | undefined;
            chestItemTypes.forEach(({ value, labelKey }) => {
                const opt = document.createElement('option');
                opt.value = value;
                opt.textContent = this.t(labelKey);
                opt.selected = (currentContains || '') === value;
                select.appendChild(opt);
            });
            select.addEventListener('change', () => {
                this.gameEngine.setObjectContainsItemById(object.id ?? '', select.value || null);
                refresh();
            });
            selectLabel.append(`${this.t('objects.chest.containsLabel')} `, select);
            config.appendChild(selectLabel);

            const checkLabel = document.createElement('label');
            checkLabel.className = 'object-config-label object-config-label--checkbox';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = isRandom;
            checkbox.addEventListener('change', () => {
                const nowRandom = checkbox.checked;
                select.disabled = nowRandom;
                this.gameEngine.setObjectRandomItemById(object.id ?? '', nowRandom);
                refresh();
            });
            checkLabel.append(checkbox, ` ${this.t('objects.chest.randomItem')}`);
            config.appendChild(checkLabel);

            wrapper.appendChild(config);
        }

        if (object.isLed) {
            const config = document.createElement('div');
            config.className = 'object-config';

            const label = document.createElement('label');
            label.className = 'object-config-label';

            const select = document.createElement('select');
            select.className = 'object-config-select';
            this.manager.npcService.populateVariableSelect(select, object.variableId || '');
            select.addEventListener('change', () => {
                this.gameEngine.setObjectVariableById(object.id ?? '', select.value);
                refresh();
            });
            label.append(`${this.t('objects.logic.variableLabel')} `, select);
            config.appendChild(label);
            wrapper.appendChild(config);
        }

        if (object.type === EditorObjectTypes.DOOR && object.opened) {
            const badge = document.createElement('div');
            badge.className = 'object-status';
            badge.textContent = this.t('objects.status.doorOpened');
            wrapper.appendChild(badge);
        }

        if (object.type === EditorObjectTypes.KEY && object.collected) {
            const badge = document.createElement('div');
            badge.className = 'object-status';
            badge.textContent = this.t('objects.status.keyCollected');
            wrapper.appendChild(badge);
        }

        if (object.type === EditorObjectTypes.LIFE_POTION && object.collected) {
            const badge = document.createElement('div');
            badge.className = 'object-status';
            badge.textContent = this.t('objects.status.potionCollected');
            wrapper.appendChild(badge);
        }

        if (object.type === EditorObjectTypes.XP_SCROLL && object.collected) {
            const badge = document.createElement('div');
            badge.className = 'object-status';
            badge.textContent = this.t('objects.status.scrollUsed');
            wrapper.appendChild(badge);
        }

        if ((object.type === EditorObjectTypes.SWORD || object.type === EditorObjectTypes.SWORD_BRONZE || object.type === EditorObjectTypes.SWORD_WOOD) && object.collected) {
            const badge = document.createElement('div');
            badge.className = 'object-status';
            badge.textContent = this.t('objects.status.swordBroken');
            wrapper.appendChild(badge);
        }

        if (object.type === EditorObjectTypes.ARMOR && object.collected) {
            const badge = document.createElement('div');
            badge.className = 'object-status';
            badge.textContent = this.t('objects.status.armorEquipped');
            wrapper.appendChild(badge);
        }

        if (object.type === EditorObjectTypes.BOOTS && object.collected) {
            const badge = document.createElement('div');
            badge.className = 'object-status';
            badge.textContent = this.t('objects.status.bootsEquipped');
            wrapper.appendChild(badge);
        }

        if (object.type === EditorObjectTypes.CHEST && object.opened) {
            const badge = document.createElement('div');
            badge.className = 'object-status';
            badge.textContent = this.t('objects.status.chestOpened');
            wrapper.appendChild(badge);
        }

        const isPlayerEnd = object.type === PLAYER_END_TYPE;
        if (isPlayerEnd) {
            const config = document.createElement('div');
            config.className = 'object-config';

            const label = document.createElement('label');
            label.className = 'object-config-label';
            label.textContent = this.t('objects.end.textLabel');

            const textarea = document.createElement('textarea');
            textarea.className = 'object-config-textarea';
            textarea.rows = 4;
            const maxLength = typeof StateObjectManager.PLAYER_END_TEXT_LIMIT === 'number'
                ? StateObjectManager.PLAYER_END_TEXT_LIMIT
                : 40;
            textarea.maxLength = maxLength;
            textarea.placeholder = this.t('objects.end.placeholder');
            textarea.value = object.endingText || '';
            textarea.addEventListener('input', () => {
                this.manager.objectService.updatePlayerEndText(object.roomIndex, textarea.value);
            });

            label.appendChild(textarea);
            config.appendChild(label);

            const hint = document.createElement('div');
            hint.className = 'object-config-hint';
            hint.textContent = this.tf('objects.end.hint', { max: maxLength });
            config.appendChild(hint);

            wrapper.appendChild(config);

            const badge = document.createElement('div');
            badge.className = 'object-status';
            badge.textContent = this.t('objects.status.gameEnd');
            wrapper.appendChild(badge);
        }

        return wrapper;
    }

    private buildLogicGateConfig(object: EditorObject, refresh: () => void): HTMLElement {
        const config = document.createElement('div');
        config.className = 'object-config';

        // Collect output variables already used by OTHER gates so they can be disabled
        const allObjects = ((this.gameEngine as unknown as { getObjects?(): EditorObject[] }).getObjects?.() || []) as EditorObject[];
        const usedOutputs = new Set<string>();
        allObjects.forEach((obj) => {
            if (obj.isLogicGate && obj.outputVariableId && obj.id !== object.id) {
                usedOutputs.add(obj.outputVariableId);
            }
        });

        const addSelect = (labelKey: string, selectedId: string, onChange: (value: string) => void, disabledIds?: Set<string>) => {
            const label = document.createElement('label');
            label.className = 'object-config-label';
            const select = document.createElement('select');
            select.className = 'object-config-select';
            this.manager.npcService.populateVariableSelect(select, selectedId);
            if (disabledIds) {
                Array.from(select.options).forEach((option) => {
                    if (option.value && disabledIds.has(option.value)) {
                        option.disabled = true;
                    }
                });
            }
            select.addEventListener('change', () => {
                onChange(select.value);
                refresh();
            });
            label.append(`${this.t(labelKey)} `, select);
            config.appendChild(label);
        };

        const gateId = object.id ?? '';
        if (object.isSingleInputGate) {
            addSelect('objects.logic.inputLabel', object.inputVariableId || '', (value) => {
                this.gameEngine.setGateInputVariableById(gateId, value || null, 1);
            });
        } else {
            addSelect('objects.logic.inputALabel', object.inputVariableId || '', (value) => {
                this.gameEngine.setGateInputVariableById(gateId, value || null, 1);
            });
            addSelect('objects.logic.inputBLabel', object.inputVariableId2 || '', (value) => {
                this.gameEngine.setGateInputVariableById(gateId, value || null, 2);
            });
        }
        addSelect('objects.logic.outputLabel', object.outputVariableId || '', (value) => {
            this.gameEngine.setGateOutputVariableById(gateId, value || null);
        }, usedOutputs);

        // Visibility toggle: shown by default; when unchecked the gate works but is invisible in-game
        const visibleLabel = document.createElement('label');
        visibleLabel.className = 'object-config-label object-config-checkbox';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = !object.hiddenInGame;
        checkbox.addEventListener('change', () => {
            this.gameEngine.setObjectHiddenInGameById(gateId, !checkbox.checked);
            refresh();
        });
        visibleLabel.append(checkbox, ` ${this.t('objects.logic.visibleInGame')}`);
        config.appendChild(visibleLabel);

        return config;
    }

    drawObjectPreview(canvas: HTMLCanvasElement, type: string): void {
        if (!(canvas instanceof HTMLCanvasElement)) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#111827';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const renderer = this.gameEngine.renderer;
        const step = canvas.width / 8;

        if (type === ONLINE_PLAYER_START_2_TYPE) {
            const sprite = renderer.spriteFactory.getNpcSprites()['villager-woman'];
            if (sprite) renderer.canvasHelper.drawSprite(ctx, sprite, 0, 0, step);
            return;
        }

        if (type === EditorObjectTypes.PLAYER_START) {
            const sprite = renderer.spriteFactory.getPlayerSprite();
            if (sprite) renderer.canvasHelper.drawSprite(ctx, sprite, 0, 0, step);
            return;
        }

        renderer.drawObjectSprite(ctx, type, 0, 0, step);
    }

    getObjectLabel(type: string, definitions: ObjectDefinitionView[]): string {
        const def = definitions.find((entry) => entry.type === type);
        if (def?.nameKey) {
            return this.t(def.nameKey, def.name || type);
        }
        if (def?.name) return def.name;
        switch (type) {
            case EditorObjectTypes.DOOR:
                return this.t('objects.label.door');
            case EditorObjectTypes.DOOR_VARIABLE:
                return this.t('objects.label.doorVariable');
            case EditorObjectTypes.PLAYER_START:
                return this.t('objects.label.playerStart');
            case ONLINE_PLAYER_START_2_TYPE:
                return this.t('objects.label.playerStart2');
            case EditorObjectTypes.PLAYER_END:
                return this.t('objects.label.playerEnd');
            case EditorObjectTypes.SWITCH:
                return this.t('objects.label.switch');
            case EditorObjectTypes.KEY:
                return this.t('objects.label.key');
            case EditorObjectTypes.LIFE_POTION:
                return this.t('objects.label.lifePotion');
            case EditorObjectTypes.SWORD:
                return this.t('objects.label.sword');
            case EditorObjectTypes.SWORD_BRONZE:
                return this.t('objects.label.swordBronze');
            case EditorObjectTypes.SWORD_WOOD:
                return this.t('objects.label.swordWood');
            case EditorObjectTypes.XP_SCROLL:
                return this.t('objects.label.xpScroll');
            case EditorObjectTypes.ARMOR:
                return this.t('objects.label.armor');
            case EditorObjectTypes.BOOTS:
                return this.t('objects.label.boots');
            case EditorObjectTypes.TRAP:
                return this.t('objects.label.trap');
            case EditorObjectTypes.PRESSURE_PLATE:
                return this.t('objects.label.pressurePlate');
            case EditorObjectTypes.CHEST:
                return this.t('objects.label.chest');
            default:
                return type;
        }
    }

    private hasCustomSprite(
        customSprites: CustomSpriteEntry[] | undefined,
        type: string,
        checkOnVariant: boolean
    ): boolean {
        if (CustomSpriteLookup.find(customSprites, 'object', type, 'base') !== null) return true;
        if (checkOnVariant && CustomSpriteLookup.find(customSprites, 'object', type, 'on') !== null) return true;
        return false;
    }
}

export { EditorObjectRenderer };
