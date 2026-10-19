import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameEngine } from '../../runtime/services/GameEngine';
import { createBaseRuntimeApi } from '../../runtime/infra/BaseRuntimeApi';
import { TinyRPG } from '../../sdk';
import { EditorNpcService } from '../../editor/modules/EditorNpcService';
import { EditorHistoryManager } from '../../editor/modules/EditorHistoryManager';

describe('NPC wandering persistence and lifecycle integration', () => {
    let engine: GameEngine;
    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(Math, 'random').mockReturnValue(0);
        engine = new GameEngine(document.createElement('canvas'), { soundOwner: false });
        const game = new TinyRPG();
        game.room(0).addNPC({ type: 'old-mage', x: 2, y: 2, wander: true, wanderSpeed: 2 });
        engine.importGameData(game.toProjectData());
        engine.dismissIntroScreen();
        vi.advanceTimersByTime(25);
    });
    afterEach(() => { engine.destroy(); vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });

    it('moves without automatically starting dialogue/combat and exports authored placement', () => {
        const npc = engine.npcManager.getNPCs()[0];
        const dialogue = vi.spyOn(engine.interactionManager, 'openNpcDialog');
        const combat = vi.spyOn(engine.enemyManager, 'handleEnemyCollision');
        vi.advanceTimersByTime(350);
        expect(npc).toMatchObject({ x: 3, y: 2 });
        expect(engine.exportGameData()).toMatchObject({ sprites: [{ x: 2, y: 2, wander: true, wanderSpeed: 2 }] });
        expect(dialogue).not.toHaveBeenCalled();
        expect(combat).not.toHaveBeenCalled();
        engine.resetGame();
        expect(npc).toMatchObject({ x: 2, y: 2, wanderSpeed: 2 });
    });

    it('halts and restores simulation across editor, online and destruction transitions', () => {
        const npc = engine.npcManager.getNPCs()[0];
        engine.gameState.setEditorMode(true);
        vi.advanceTimersByTime(700);
        expect(npc.x).toBe(2);
        engine.gameState.setEditorMode(false);
        vi.advanceTimersByTime(350);
        expect(npc.x).toBe(3);
        engine.online.setMode('online-host');
        expect(npc.x).toBe(2);
        vi.advanceTimersByTime(700);
        expect(npc.x).toBe(2);
        engine.online.setMode('online-guest');
        vi.advanceTimersByTime(700);
        expect(npc.x).toBe(2);
        engine.online.setMode('solo');
        engine.destroy();
        vi.advanceTimersByTime(700);
        expect(npc.x).toBe(2);
    });

    it('validates SDK updateNPC atomically and retains movement through runtime import/export', () => {
        const api = createBaseRuntimeApi(engine);
        const npc = api.getSprites()[0];
        for (const wanderSpeed of [-1, 3, NaN, Infinity, null, '1']) {
            expect(() => api.updateNPC(npc.id, { wanderSpeed } as never)).toThrow();
            expect(api.getSprites()[0].wanderSpeed).toBe(2);
        }
        expect(() => api.updateNPC(npc.id, { wander: 'yes' } as never)).toThrow();
        api.updateNPC(npc.id, { wander: false, wanderSpeed: 0 });
        const snapshot = api.exportGameData();
        api.importGameData(snapshot);
        expect(api.getSprites()[0]).toMatchObject({ wander: false, wanderSpeed: 0 });
        api.destroy();
    });

    it('undoes and redoes movement settings through editor service and history', () => {
        const npcId = engine.npcManager.getNPCs()[0].id;
        const manager = {
            gameEngine: engine,
            state: { selectedNpcId: npcId },
            renderService: { renderNpcs: vi.fn(), renderWorldGrid: vi.fn(), renderEditor: vi.fn() },
            updateJSON: vi.fn(),
            restore: (data: unknown) => engine.importGameData(data),
            history: undefined as unknown as EditorHistoryManager,
        };
        manager.history = new EditorHistoryManager(manager as never);
        const service = new EditorNpcService(manager as never);
        manager.history.pushCurrentState();
        service.updateNpcWanderSpeed(0.5);
        service.updateNpcWander(false);
        manager.history.undo();
        expect(engine.npcManager.getNPCs()[0]).toMatchObject({ wander: true, wanderSpeed: 0.5 });
        manager.history.undo();
        expect(engine.npcManager.getNPCs()[0]).toMatchObject({ wander: true, wanderSpeed: 2 });
        manager.history.redo();
        manager.history.redo();
        expect(engine.npcManager.getNPCs()[0]).toMatchObject({ wander: false, wanderSpeed: 0.5 });
    });
});
