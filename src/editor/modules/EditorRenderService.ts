
import { SkillDefinitions } from '../../runtime/domain/definitions/SkillDefinitions';
import { TextResources } from '../../runtime/adapters/TextResources';
import { PICO8_COLORS } from '../../runtime/domain/definitions/TileDefinitions';
import { EditorCanvasRenderer } from './renderers/EditorCanvasRenderer';
import { EditorEnemyRenderer } from './renderers/EditorEnemyRenderer';
import { EditorNpcRenderer } from './renderers/EditorNpcRenderer';
import { EditorObjectRenderer } from './renderers/EditorObjectRenderer';
import { EditorTilePanelRenderer } from './renderers/EditorTilePanelRenderer';
import { EditorWorldRenderer } from './renderers/EditorWorldRenderer';
import type { EditorManager } from '../EditorManager';
import type { VariableDefinition } from '../../types/gameState';
import type { SkillDefinitionData } from '../../runtime/domain/entities/Skill';

type VariableEntry = VariableDefinition & { name?: string; color?: string };

type SpriteData = {
    conditionVariableId?: string | null;
    conditionalVariableId?: string | null;
    rewardVariableId?: string | null;
    activateVariableId?: string | null;
    onCompleteVariableId?: string | null;
    conditionalRewardVariableId?: string | null;
    alternativeRewardVariableId?: string | null;
};

type EnemyData = {
    defeatVariableId?: string | null;
};

type ObjectData = {
    variableId?: string | null;
};

type SkillData = SkillDefinitionData & {
    name?: string;
    description?: string;
    icon?: string;
};

class EditorRenderService {
    manager: EditorManager;
    canvasRenderer: EditorCanvasRenderer;
    tilePanelRenderer: EditorTilePanelRenderer;
    npcRenderer: EditorNpcRenderer;
    enemyRenderer: EditorEnemyRenderer;
    worldRenderer: EditorWorldRenderer;
    objectRenderer: EditorObjectRenderer;
    handleTileAnimationFrame: () => void;

    constructor(editorManager: EditorManager) {
        this.manager = editorManager;
        this.canvasRenderer = new EditorCanvasRenderer(this);
        this.tilePanelRenderer = new EditorTilePanelRenderer(this);
        this.npcRenderer = new EditorNpcRenderer(this);
        this.enemyRenderer = new EditorEnemyRenderer(this);
        this.worldRenderer = new EditorWorldRenderer(this);
        this.objectRenderer = new EditorObjectRenderer(this);
        this.handleTileAnimationFrame = () => {
            this.renderEditor();
            this.updateSelectedTilePreview();
        };
        globalThis.addEventListener('tile-animation-frame', this.handleTileAnimationFrame);
    }

    get textResources() {
        return TextResources;
    }

    t(key: string, fallback = '') {
        const resource = this.textResources as typeof TextResources & { get?: (key: string, fallback: string) => string };
        const value = resource.get(key, fallback);
        if (value) return value;
        if (fallback) return fallback;
        return key || '';
    }

    tf(key: string, params: Record<string, string | number> = {}, fallback = '') {
        const resource = this.textResources as typeof TextResources & { format?: (key: string, params: Record<string, string | number>, fallback: string) => string };
        return resource.format(key, params, fallback);
    }

    get dom() {
        return this.manager.domCache;
    }

    get gameEngine() {
        return this.manager.gameEngine;
    }

    get state() {
        return this.manager.state;
    }

    get picoPalette() {
        return PICO8_COLORS;
    }

    resolvePicoColor(raw: string | number | null) {
        const palette = this.picoPalette;
        if (!palette.length) return raw || '#000000';
        if (Number.isInteger(raw)) {
            return palette[raw as number] ?? palette[0];
        }
        if (typeof raw !== 'string') return palette[0];
        const normalize = (value: string | number | null) => String(value || '').replace('#', '').trim().toUpperCase();
        const target = normalize(raw);
        const idx = palette.findIndex((color: string) => normalize(color) === target);
        if (idx !== -1) return palette[idx];
        return palette[0];
    }

    renderEditor() {
        this.canvasRenderer.renderEditor();
        this.worldRenderer.renderMapNavigation();
    }

    renderTileList() {
        this.tilePanelRenderer.renderTileList();
    }

    renderNpcs() {
        this.npcRenderer.renderNpcs();
    }

    updateNpcForm() {
        this.npcRenderer.updateNpcForm();
    }

    renderEnemies() {
        this.enemyRenderer.renderEnemies();
    }

    renderEnemyCatalog() {
        this.enemyRenderer.renderEnemyCatalog();
    }

    renderObjectCatalog() {
        this.objectRenderer.renderObjectCatalog();
    }

    renderObjects() {
        this.objectRenderer.renderObjects();
    }

    renderWorldGrid() {
        this.worldRenderer.renderWorldGrid();
    }

    renderMapNavigation() {
        this.worldRenderer.renderMapNavigation();
    }

    updateMapPosition(col: number, row: number) {
        this.worldRenderer.updateMapPosition(col, row);
    }

    updateSelectedTilePreview() {
        this.tilePanelRenderer.updateSelectedTilePreview();
    }

    renderVariableUsage() {
        const list = this.dom.projectVariableList;
        if (!list) return;
        const container = this.dom.projectVariablesContainer;
        const toggle = this.dom.projectVariablesToggle;
        list.innerHTML = '';

        const variables = (this.gameEngine.getVariableDefinitions()) as VariableEntry[];
        const usedSet = this.collectVariableUsage();
        const usedCount = variables.reduce(
            (count: number, variable: VariableEntry) => count + (usedSet.has(variable.id) ? 1 : 0),
            0
        );
        const usageText = this.tf(
            'project.variables.usage',
            { used: usedCount, total: variables.length },
            `${usedCount}/${variables.length}`
        );

        const collapsed = Boolean(this.state.variablePanelCollapsed);
        if (toggle) {
            toggle.setAttribute('aria-expanded', String(!collapsed));
            toggle.setAttribute('aria-controls', 'project-variable-usage-list');
            const actionText = collapsed
                ? this.t('project.variables.toggle.show', 'Mostrar variáveis')
                : this.t('project.variables.toggle.hide', 'Esconder variáveis');
            toggle.textContent = `${usageText} · ${actionText}`;
        }
        if (container) {
            container.classList.toggle('is-collapsed', collapsed);
        }

        if (!variables.length) {
            const empty = document.createElement('div');
            empty.className = 'project-variable-item';
            const label = document.createElement('span');
            label.className = 'project-variable-name';
            label.textContent = this.t('variables.none', 'Nenhuma');
            empty.appendChild(label);
            list.appendChild(empty);
            return;
        }

        variables.forEach((variable: VariableEntry) => {
            const item = document.createElement('div');
            item.className = 'project-variable-item';

            const color = document.createElement('span');
            color.className = 'project-variable-color';
            color.style.background = String(this.resolvePicoColor(variable.color ?? null));

            const name = document.createElement('span');
            name.className = 'project-variable-name';
            name.textContent = variable.name || variable.id;

            const badge = document.createElement('span');
            const inUse = usedSet.has(variable.id);
            badge.className = `project-variable-badge ${inUse ? 'in-use' : 'unused'}`;
            badge.textContent = inUse
                ? this.t('project.variables.used', 'Em uso')
                : this.t('project.variables.unused', 'Sem uso');

            item.append(color, name, badge);
            list.appendChild(item);
        });
    }

    renderSkillList() {
        const list = this.dom.projectSkillsList;
        if (!list) return;
        const container = this.dom.projectSkillsContainer;
        const toggle = this.dom.projectSkillsToggle;
        const game = this.gameEngine.getGame() as { skillOrder?: string[]; disableSkills?: boolean };
        list.innerHTML = '';

        const collapsed = Boolean(this.state.skillPanelCollapsed);
        const title = this.t('project.skills.title', 'Skills do jogo');
        if (toggle) {
            toggle.setAttribute('aria-expanded', String(!collapsed));
            toggle.setAttribute('aria-controls', 'project-skills-list');
            const actionText = collapsed
                ? this.t('project.skills.toggle.show', 'Mostrar skills')
                : this.t('project.skills.toggle.hide', 'Esconder skills');
            toggle.textContent = `${title} · ${actionText}`;
        }
        list.setAttribute('aria-label', title);
        if (container) {
            container.classList.toggle('is-collapsed', collapsed);
        }

        const defaultOrder = SkillDefinitions.getDefaultSkillOrder();
        const hasCustomOrder = Array.isArray(game.skillOrder) && game.skillOrder.length > 0 &&
            !(game.skillOrder.length === defaultOrder.length &&
              game.skillOrder.every((id, i) => id === (defaultOrder as string[])[i]));
        if (this.dom.projectSkillsResetOrder) {
            this.dom.projectSkillsResetOrder.hidden = !hasCustomOrder;
        }

        if (collapsed) {
            return;
        }
        if (game.disableSkills) {
            const empty = document.createElement('li');
            empty.className = 'project-skill-item';
            const text = document.createElement('span');
            text.className = 'project-skill-name';
            text.textContent = this.t('project.skills.disabled', 'Sistema de skills desativado');
            empty.appendChild(text);
            list.appendChild(empty);
            return;
        }

        const allSkills = SkillDefinitions.getAll();
        if (!allSkills.length) {
            const empty = document.createElement('li');
            empty.className = 'project-skill-item';
            const text = document.createElement('span');
            text.className = 'project-skill-name';
            text.textContent = this.t('variables.none', 'Nenhuma');
            empty.appendChild(text);
            list.appendChild(empty);
            return;
        }

        // Build ordered list: use custom skillOrder if set, else default level order
        const rawOrder: string[] = Array.isArray(game.skillOrder) && game.skillOrder.length
            ? game.skillOrder
            : defaultOrder;
        // Ensure all skill IDs are present (add missing at end, remove unknowns)
        const knownIds = new Set(allSkills.map((s) => s.id));
        const ordered = rawOrder.filter((id) => knownIds.has(id));
        allSkills.forEach((s) => { if (!ordered.includes(s.id)) ordered.push(s.id); });

        // Level label per position using DEFAULT_LEVEL_SLOTS
        const levelAtPosition: number[] = [];
        for (const slot of SkillDefinitions.DEFAULT_LEVEL_SLOTS) {
            for (let i = 0; i < slot.count; i++) levelAtPosition.push(slot.level);
        }

        ordered.forEach((skillId, index) => {
            const skill = SkillDefinitions.getById(skillId);
            if (!skill) return;
            const item = document.createElement('li');
            item.className = 'project-skill-item';
            item.dataset.skillId = skillId;
            item.dataset.index = String(index);

            const handle = document.createElement('span');
            handle.className = 'project-skill-drag-handle';
            handle.textContent = '☰';
            handle.title = this.t('project.skills.drag', 'Arrastar para reordenar');
            handle.setAttribute('aria-hidden', 'true');

            const icon = document.createElement('span');
            icon.className = 'project-skill-icon';
            icon.textContent = skill.icon || '✨';
            icon.setAttribute('aria-hidden', 'true');

            const nameEl = document.createElement('strong');
            nameEl.className = 'project-skill-name';
            nameEl.textContent = skill.nameKey ? this.t(skill.nameKey, skill.id) : skill.id;

            const levelLabel = levelAtPosition[index];
            const badge = document.createElement('span');
            badge.className = 'project-skill-level-badge';
            badge.textContent = levelLabel
                ? this.tf('project.skills.level', { value: levelLabel }, `Nível ${levelLabel}`)
                : '';

            const desc = document.createElement('p');
            desc.className = 'project-skill-desc';
            desc.textContent = skill.descriptionKey ? this.t(skill.descriptionKey, '') : '';

            item.append(handle, icon, nameEl, badge, desc);
            list.appendChild(item);
        });

        this.attachSkillDragHandlers(list, ordered);
    }

    private attachSkillDragHandlers(listEl: HTMLElement, skillOrder: string[]) {
        const getItems = () => Array.from(listEl.querySelectorAll<HTMLElement>('.project-skill-item[data-skill-id]'));
        const clearDragClasses = () => {
            getItems().forEach((el) => {
                el.classList.remove('is-dragging', 'is-drag-over-above', 'is-drag-over-below');
            });
        };

        getItems().forEach((item, fromIndex) => {
            const handle = item.querySelector<HTMLElement>('.project-skill-drag-handle');
            if (!handle) return;

            let toIndex = fromIndex;
            let ghost: HTMLElement | null = null;
            let offsetX = 0;
            let offsetY = 0;

            const onMove = (e: PointerEvent) => {
                if (ghost) {
                    ghost.style.left = `${e.clientX - offsetX}px`;
                    ghost.style.top = `${e.clientY - offsetY}px`;
                }

                const items = getItems();
                let newIndex = items.length - 1;
                for (let i = 0; i < items.length; i++) {
                    const rect = items[i].getBoundingClientRect();
                    if (e.clientY < rect.top + rect.height / 2) {
                        newIndex = i;
                        break;
                    }
                }
                if (newIndex !== toIndex) {
                    toIndex = newIndex;
                    clearDragClasses();
                    item.classList.add('is-dragging');
                    if (toIndex !== fromIndex) {
                        items[toIndex].classList.add(toIndex < fromIndex ? 'is-drag-over-above' : 'is-drag-over-below');
                    }
                }
            };

            const onUp = () => {
                handle.removeEventListener('pointermove', onMove);
                handle.removeEventListener('pointerup', onUp);
                handle.removeEventListener('pointercancel', onUp);
                ghost?.remove();
                ghost = null;
                clearDragClasses();

                if (toIndex !== fromIndex) {
                    const newOrder = skillOrder.slice();
                    const [moved] = newOrder.splice(fromIndex, 1);
                    newOrder.splice(toIndex, 0, moved);
                    this.manager.uiController.setSkillOrder(newOrder);
                }
            };

            handle.addEventListener('pointerdown', (e: PointerEvent) => {
                e.preventDefault();
                toIndex = fromIndex;
                try { handle.setPointerCapture(e.pointerId); } catch { /* ignore */ }

                const rect = item.getBoundingClientRect();
                offsetX = e.clientX - rect.left;
                offsetY = e.clientY - rect.top;

                ghost = item.cloneNode(true) as HTMLElement;
                ghost.classList.remove('is-dragging');
                ghost.classList.add('is-drag-ghost');
                ghost.style.width = `${rect.width}px`;
                ghost.style.left = `${rect.left}px`;
                ghost.style.top = `${rect.top}px`;
                document.body.appendChild(ghost);

                clearDragClasses();
                item.classList.add('is-dragging');
                handle.addEventListener('pointermove', onMove);
                handle.addEventListener('pointerup', onUp);
                handle.addEventListener('pointercancel', onUp);
            });
        });
    }

    collectVariableUsage() {
        const used = new Set<string>();
        const game = (this.gameEngine.getGame()) as {
            sprites?: SpriteData[];
            enemies?: EnemyData[];
            objects?: ObjectData[];
        };
        const variables = (this.gameEngine.getVariableDefinitions()) as VariableEntry[];
        const validIds = new Set(variables.map((variable: VariableEntry) => variable.id));
        const addIfValid = (id: string | null | undefined) => {
            if (typeof id !== 'string') return;
            const normalized = id.trim();
            if (normalized && validIds.has(normalized)) {
                used.add(normalized);
            }
        };

        const sprites = Array.isArray(game.sprites) ? game.sprites : [];
        sprites.forEach((npc: SpriteData) => {
            [
                npc.conditionVariableId,
                npc.conditionalVariableId,
                npc.rewardVariableId,
                npc.activateVariableId,
                npc.onCompleteVariableId,
                npc.conditionalRewardVariableId,
                npc.alternativeRewardVariableId
            ].forEach(addIfValid);
        });

        const enemies = Array.isArray(game.enemies) ? game.enemies : [];
        enemies.forEach((enemy: EnemyData) => addIfValid(enemy.defeatVariableId));

        const objects = Array.isArray(game.objects) ? game.objects : [];
        objects.forEach((object: ObjectData) => addIfValid(object.variableId));

        return used;
    }

    buildSkillLevelMap(): Map<string, number> {
        const levelMap = new Map<string, number>();
        const entries = SkillDefinitions.LEVEL_SKILLS;
        Object.entries(entries).forEach(([levelKey, ids]) => {
            const level = Number(levelKey);
            if (!Number.isFinite(level)) return;
            (Array.isArray(ids) ? ids : []).forEach((id: string) => {
                if (typeof id !== 'string') return;
                const currentLevel = levelMap.get(id);
                if (currentLevel === undefined || level < currentLevel) {
                    levelMap.set(id, level);
                }
            });
        });
        return levelMap;
    }

    groupSkillsByLevel(skills: SkillData[], levelMap: Map<string, number>) {
        const buckets = new Map<number | 'other', SkillData[]>();
        skills.forEach((skill: SkillData) => {
            const level = levelMap.get(skill.id) ?? null;
            const key: number | 'other' = Number.isFinite(level) ? level as number : 'other';
            if (!buckets.has(key)) {
                buckets.set(key, []);
            }
            const bucket = buckets.get(key);
            if (bucket) {
                bucket.push(skill);
            }
        });
        const sortedKeys = Array.from(buckets.keys()).sort((a: number | 'other', b: number | 'other') => {
            const na = typeof a === 'number' ? a : Infinity;
            const nb = typeof b === 'number' ? b : Infinity;
            return na - nb;
        });
        return sortedKeys.map((key) => ({
            level: Number.isFinite(key) ? key : null,
            items: buckets.get(key) || []
        }));
    }

    renderTestTools() {
        const container = this.dom.projectTestContainer;
        const toggle = this.dom.projectTestToggle;
        const panel = this.dom.projectTestPanel;
        const startLevelSelect = this.dom.projectTestStartLevel;
        const skillList = this.dom.projectTestSkillList;
        const godModeInput = this.dom.projectTestGodMode;
        const game = this.gameEngine.getGame() as { disableSkills?: boolean };
        if (!container || !toggle || !panel) return;

        const collapsed = Boolean(this.state.testPanelCollapsed);
        const title = this.t('project.test.title', 'Ajuda nos testes');
        const actionText = collapsed
            ? this.t('project.test.toggle.show', 'Mostrar')
            : this.t('project.test.toggle.hide', 'Esconder');
        toggle.setAttribute('aria-expanded', String(!collapsed));
        toggle.setAttribute('aria-controls', 'project-test-panel');
        toggle.textContent = `${title} · ${actionText}`;
        container.classList.toggle('is-collapsed', collapsed);

        const settings = this.gameEngine.getTestSettings();
        const maxLevel = this.gameEngine.getMaxPlayerLevel();

        const hint = container.querySelector('.project-test__hint');
        if (hint) {
            hint.textContent = this.t(
                'project.test.hint',
                'Apenas para testar: estas opções não vão para a URL.'
            );
        }

        if (startLevelSelect) {
            startLevelSelect.innerHTML = '';
            for (let lvl = 1; lvl <= maxLevel; lvl++) {
                const option = document.createElement('option');
                option.value = String(lvl);
                option.textContent = this.tf(
                    'project.test.levelOption',
                    { value: lvl },
                    `Nível ${lvl}`
                );
                if (lvl === settings.startLevel) {
                    option.selected = true;
                }
                startLevelSelect.appendChild(option);
            }
        }

        if (godModeInput) {
            godModeInput.checked = Boolean(settings.godMode);
        }

        if (skillList) {
            skillList.innerHTML = '';
            if (game.disableSkills) {
                const li = document.createElement('li');
                li.className = 'project-test__skill';
                li.textContent = this.t('project.test.skillsDisabled', 'Skills desativadas para este jogo.');
                skillList.appendChild(li);
                return;
            }
            const skills = SkillDefinitions.getAll();
            const selected = new Set(Array.isArray(settings.skills) ? settings.skills : []);

            if (!skills.length) {
                const li = document.createElement('li');
                li.className = 'project-test__skill';
                li.textContent = this.t('variables.none', 'Nenhuma');
                skillList.appendChild(li);
                return;
            }

            skills.forEach((skill: SkillData) => {
                const li = document.createElement('li');

                const wrapper = document.createElement('label');
                wrapper.className = 'project-test__skill';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.dataset.skillId = skill.id;
                checkbox.checked = selected.has(skill.id);

                const label = document.createElement('div');
                label.className = 'project-test__skill-label';
                const icon = document.createElement('span');
                icon.className = 'project-test__skill-icon';
                icon.textContent = skill.icon || '✨';
                icon.setAttribute('aria-hidden', 'true');
                const name = document.createElement('span');
                name.textContent = skill.nameKey
                    ? this.t(skill.nameKey, skill.name || skill.id || '')
                    : (skill.name || skill.id || '');

                label.append(icon, name);
                wrapper.append(checkbox, label);
                li.appendChild(wrapper);
                skillList.appendChild(li);
            });
        }
    }
}

export { EditorRenderService };
