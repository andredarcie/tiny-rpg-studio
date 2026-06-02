
import { EditorRendererBase } from './renderers/EditorRendererBase';
import { EditorConstants } from './EditorConstants';
import { ITEM_TYPES } from '../../runtime/domain/constants/itemTypes';
import type { EditorRenderService } from './EditorRenderService';

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
};

class ObjectEditModal extends EditorRendererBase {
    private currentObjectId: string | null = null;

    constructor(service: EditorRenderService) {
        super(service);
        this.bindStaticEvents();
    }

    private bindStaticEvents(): void {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.dom.objectEditModal && !this.dom.objectEditModal.hidden) {
                e.preventDefault();
                this.close();
            }
        });

    }

    open(objectId: string): void {
        const objects = (this.gameEngine.getObjectsForRoom(this.state.activeRoomIndex) || []) as EditorObject[];
        const object = objects.find((o) => o.id === objectId);
        if (!object) return;

        this.currentObjectId = objectId;
        const modal = this.dom.objectEditModal;
        if (!modal) return;

        const existing = modal.querySelector('.object-edit-modal__panel');
        if (existing) existing.remove();

        modal.appendChild(this.buildPanel(object));
        modal.hidden = false;
    }

    close(): void {
        const modal = this.dom.objectEditModal;
        if (modal) modal.hidden = true;
        this.currentObjectId = null;
    }

    private buildPanel(object: EditorObject): HTMLElement {
        const panel = document.createElement('div');
        panel.className = 'object-edit-modal__panel';

        panel.appendChild(this.buildHeader(object));

        const afterChange = () => {
            if (this.currentObjectId) this.open(this.currentObjectId);
        };
        const configArea = this.service.objectRenderer.buildObjectConfigArea(object, afterChange);
        configArea.className = 'object-edit-modal__config';
        panel.appendChild(configArea);

        panel.appendChild(this.buildFooter(object));
        return panel;
    }

    private buildHeader(object: EditorObject): HTMLElement {
        const header = document.createElement('div');
        header.className = 'object-edit-modal__header';

        const preview = document.createElement('canvas');
        preview.width = 48;
        preview.height = 48;
        preview.className = 'object-preview object-edit-modal__preview';
        this.service.objectRenderer.drawObjectPreview(preview, object.type);

        const titleGroup = document.createElement('div');
        titleGroup.className = 'object-edit-modal__title-group';

        const definitions = EditorConstants.OBJECT_DEFINITIONS as ObjectDefinitionView[];
        const title = document.createElement('h3');
        title.className = 'object-edit-modal__title';
        title.textContent = this.service.objectRenderer.getObjectLabel(object.type, definitions);

        const pos = document.createElement('span');
        pos.className = 'object-position';
        pos.textContent = `(${object.x}, ${object.y})`;

        const descKey = this.getDescriptionKey(object.type);
        const descText = descKey ? this.t(descKey) : '';

        titleGroup.append(title, pos);

        if (descText) {
            const desc = document.createElement('p');
            desc.className = 'object-edit-modal__desc';
            desc.textContent = descText;
            titleGroup.appendChild(desc);
        }

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'object-edit-modal__close';
        closeBtn.setAttribute('aria-label', this.t('buttons.close', 'Fechar'));
        closeBtn.textContent = '✕';
        closeBtn.addEventListener('click', () => this.close());

        header.append(preview, titleGroup, closeBtn);
        return header;
    }

    private buildFooter(object: EditorObject): HTMLElement {
        const footer = document.createElement('div');
        footer.className = 'object-edit-modal__footer';

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'btn-secondary';
        closeBtn.textContent = this.t('buttons.close', 'Fechar');
        closeBtn.addEventListener('click', () => this.close());
        footer.appendChild(closeBtn);

        if (object.id && object.type) {
            const moveBtn = document.createElement('button');
            moveBtn.type = 'button';
            moveBtn.className = 'btn-secondary object-edit-modal__move';
            moveBtn.textContent = this.t('buttons.move', 'Mover');
            moveBtn.addEventListener('click', () => {
                const definitions = EditorConstants.OBJECT_DEFINITIONS as ObjectDefinitionView[];
                const name = this.service.objectRenderer.getObjectLabel(object.type, definitions);
                this.manager.objectService.startRepositioning(object.id ?? '', object.type, name);
                this.close();
            });
            footer.appendChild(moveBtn);
        }

        if (object.type !== ITEM_TYPES.PLAYER_START) {
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'btn-secondary object-edit-modal__remove';
            removeBtn.textContent = this.t('buttons.remove', 'Remover');
            removeBtn.addEventListener('click', () => {
                if (object.id) {
                    this.manager.objectService.removeObjectById(object.id);
                } else {
                    this.manager.objectService.removeObject(object.type, object.roomIndex);
                }
                this.manager.updateJSON();
                this.manager.history.pushCurrentState();
                this.close();
            });
            footer.appendChild(removeBtn);
        }

        return footer;
    }

    private getDescriptionKey(type: string): string {
        const map: Record<string, string> = {
            [ITEM_TYPES.PLAYER_START]:     'objects.desc.playerStart',
            [ITEM_TYPES.PLAYER_END]:       'objects.desc.playerEnd',
            [ITEM_TYPES.SWITCH]:           'objects.desc.switch',
            [ITEM_TYPES.DOOR]:             'objects.desc.door',
            [ITEM_TYPES.DOOR_VARIABLE]:    'objects.desc.doorVariable',
            [ITEM_TYPES.KEY]:              'objects.desc.key',
            [ITEM_TYPES.LIFE_POTION]:      'objects.desc.lifePotion',
            [ITEM_TYPES.XP_SCROLL]:        'objects.desc.xpScroll',
            [ITEM_TYPES.SWORD]:            'objects.desc.sword',
            [ITEM_TYPES.SWORD_BRONZE]:     'objects.desc.swordBronze',
            [ITEM_TYPES.SWORD_WOOD]:       'objects.desc.swordWood',
            [ITEM_TYPES.ARMOR]:            'objects.desc.armor',
            [ITEM_TYPES.BOOTS]:            'objects.desc.boots',
            [ITEM_TYPES.TRAP]:             'objects.desc.trap',
            [ITEM_TYPES.PRESSURE_PLATE]:   'objects.desc.pressurePlate',
            [ITEM_TYPES.CHEST]:            'objects.desc.chest',
            [ITEM_TYPES.LOGIC_GATE_NOT]:   'objects.desc.logicGateNot',
            [ITEM_TYPES.LOGIC_GATE_AND]:   'objects.desc.logicGateAnd',
            [ITEM_TYPES.LOGIC_GATE_OR]:    'objects.desc.logicGateOr',
            [ITEM_TYPES.LOGIC_GATE_NAND]:  'objects.desc.logicGateNand',
            [ITEM_TYPES.LOGIC_GATE_NOR]:   'objects.desc.logicGateNor',
            [ITEM_TYPES.LOGIC_LED]:        'objects.desc.logicLed',
            [ITEM_TYPES.PUSH_BOX]:         'objects.desc.pushBox',
        };
        return map[type] || '';
    }
}

export { ObjectEditModal };
