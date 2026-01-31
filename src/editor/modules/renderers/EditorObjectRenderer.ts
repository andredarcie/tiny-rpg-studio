
import { StateObjectManager } from '../../../runtime/domain/state/StateObjectManager';
import { ITEM_TYPES } from '../../../runtime/domain/constants/itemTypes';
import { EditorConstants } from '../EditorConstants';
import { EditorRendererBase } from './EditorRendererBase';

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
};

class EditorObjectRenderer extends EditorRendererBase {
    renderObjectCatalog(): void {
        const container = this.dom.objectTypes;
        if (!container) return;
        container.innerHTML = '';

        const definitions = EditorConstants.OBJECT_DEFINITIONS as ObjectDefinitionView[];
        if (!Array.isArray(definitions) || !definitions.length) return;

        const selectedType = this.manager.selectedObjectType;
        const placedObjects = (this.gameEngine.getObjectsForRoom(this.state.activeRoomIndex) || []) as EditorObject[];
        const placedTypes = new Set(placedObjects.map((object) => object.type));

        definitions.forEach((definition) => {
            const card = document.createElement('div');
            card.className = 'object-type-card';
            card.dataset.type = definition.type;
            if (definition.type === selectedType) {
                card.classList.add('selected');
            }
            if (placedTypes.has(definition.type)) {
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
            name.textContent = this.getObjectLabel(definition.type, definitions);

            const info = document.createElement('div');
            info.className = 'object-type-info';
            info.textContent = placedTypes.has(definition.type)
                ? this.t('objects.info.placed')
                : this.t('objects.info.available');

            meta.append(name, info);
            card.append(preview, meta);
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

            if (object.type === EditorObjectTypes.SWITCH || object.type === DOOR_VARIABLE_TYPE) {
                const config = document.createElement('div');
                config.className = 'object-config';

                const label = document.createElement('label');
                label.className = 'object-config-label';

                const select = document.createElement('select');
                select.className = 'object-config-select';
                this.manager.npcService.populateVariableSelect(select, object.variableId || '');
                select.addEventListener('change', () => {
                    this.gameEngine.setObjectVariable(object.type, object.roomIndex, select.value);
                    this.renderObjects();
                    this.service.worldRenderer.renderWorldGrid();
                    this.manager.updateJSON();
                    this.manager.history.pushCurrentState();
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

                body.appendChild(config);
            }

            if (object.type === EditorObjectTypes.DOOR && object.opened) {
                const badge = document.createElement('div');
                badge.className = 'object-status';
                badge.textContent = this.t('objects.status.doorOpened');
                body.appendChild(badge);
            }

            if (object.type === EditorObjectTypes.KEY && object.collected) {
                const badge = document.createElement('div');
                badge.className = 'object-status';
                badge.textContent = this.t('objects.status.keyCollected');
                body.appendChild(badge);
            }

            if (object.type === EditorObjectTypes.LIFE_POTION && object.collected) {
                const badge = document.createElement('div');
                badge.className = 'object-status';
                badge.textContent = this.t('objects.status.potionCollected');
                body.appendChild(badge);
            }

            if (object.type === EditorObjectTypes.XP_SCROLL && object.collected) {
                const badge = document.createElement('div');
                badge.className = 'object-status';
                badge.textContent = this.t('objects.status.scrollUsed');
                body.appendChild(badge);
            }

            if ((object.type === EditorObjectTypes.SWORD || object.type === EditorObjectTypes.SWORD_BRONZE || object.type === EditorObjectTypes.SWORD_WOOD) && object.collected) {
                const badge = document.createElement('div');
                badge.className = 'object-status';
                badge.textContent = this.t('objects.status.swordBroken');
                body.appendChild(badge);
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

                body.appendChild(config);
            }

            if (isPlayerEnd) {
                const badge = document.createElement('div');
                badge.className = 'object-status';
                badge.textContent = this.t('objects.status.gameEnd');
                body.appendChild(badge);
            }

            if (object.type !== EditorObjectTypes.PLAYER_START) {
                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'object-remove';
                removeBtn.dataset.type = object.type;
                removeBtn.dataset.roomIndex = String(object.roomIndex);
                removeBtn.textContent = this.t('buttons.remove');
                body.appendChild(removeBtn);
            } else {
                const badge = document.createElement('div');
                badge.className = 'object-status';
                badge.textContent = this.t('objects.status.startMarker');
                body.appendChild(badge);
            }

            card.append(preview, body);
            container.appendChild(card);
        });
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
            default:
                return type;
        }
    }
}

export { EditorObjectRenderer };
