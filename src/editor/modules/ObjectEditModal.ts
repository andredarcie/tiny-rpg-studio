
import { EditorRendererBase } from './renderers/EditorRendererBase';
import { EditorConstants } from './EditorConstants';
import { ITEM_TYPES } from '../../runtime/domain/constants/itemTypes';
import { EditorModal } from './EditorModal';
import type { EditorModalButton } from './EditorModal';
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
    private readonly modal: EditorModal;

    constructor(service: EditorRenderService) {
        super(service);
        this.modal = new EditorModal(() => this.dom.objectEditModal);
    }

    open(objectId: string): void {
        const objects = (this.gameEngine.getObjectsForRoom(this.state.activeRoomIndex) || []) as EditorObject[];
        const object = objects.find((o) => o.id === objectId);
        if (!object) return;

        this.currentObjectId = objectId;

        const definitions = EditorConstants.OBJECT_DEFINITIONS as ObjectDefinitionView[];
        const descKey = this.getDescriptionKey(object.type);

        this.modal.open({
            header: {
                title: this.service.objectRenderer.getObjectLabel(object.type, definitions),
                subtitle: `(${object.x}, ${object.y})`,
                description: descKey ? this.t(descKey) : '',
                drawPreview: (canvas) => this.service.objectRenderer.drawObjectPreview(canvas, object.type),
            },
            body: this.buildConfigArea(object),
            buttons: this.buildButtons(object),
            closeLabel: this.t('buttons.close', 'Fechar'),
            onClose: () => this.close(),
        });
    }

    close(): void {
        this.modal.close();
        this.currentObjectId = null;
    }

    private buildConfigArea(object: EditorObject): HTMLElement {
        const afterChange = () => {
            if (this.currentObjectId) this.open(this.currentObjectId);
        };
        const configArea = this.service.objectRenderer.buildObjectConfigArea(object, afterChange);
        configArea.className = 'object-edit-modal__config';
        return configArea;
    }

    private buildButtons(object: EditorObject): EditorModalButton[] {
        const buttons: EditorModalButton[] = [];

        if (object.id && object.type) {
            buttons.push({
                label: this.t('buttons.move', 'Mover'),
                variant: 'move',
                onClick: () => {
                    const definitions = EditorConstants.OBJECT_DEFINITIONS as ObjectDefinitionView[];
                    const name = this.service.objectRenderer.getObjectLabel(object.type, definitions);
                    this.manager.objectService.startRepositioning(object.id ?? '', object.type, name);
                    this.close();
                },
            });
        }

        if (object.type !== ITEM_TYPES.PLAYER_START) {
            buttons.push({
                label: this.t('buttons.remove', 'Remover'),
                variant: 'remove',
                onClick: () => {
                    if (object.id) {
                        this.manager.objectService.removeObjectById(object.id);
                    } else {
                        this.manager.objectService.removeObject(object.type, object.roomIndex);
                    }
                    this.manager.updateJSON();
                    this.manager.history.pushCurrentState();
                    this.close();
                },
            });
        }

        return buttons;
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
