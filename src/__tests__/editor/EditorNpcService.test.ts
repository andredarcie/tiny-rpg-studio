/* eslint-disable */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorNpcService } from '../../editor/modules/EditorNpcService';

vi.mock('../../runtime/adapters/TextResources', () => ({
  TextResources: { get: vi.fn((_k: string, fb?: string) => fb || _k) },
}));

function makeManager(ov: Record<string, any> = {}) {
  const canvas = document.createElement('canvas');
  const state = { selectedNpcId: null, selectedNpcType: null, activeRoomIndex: 0, placingNpc: false, placingEnemy: false, placingObjectType: null, conditionalDialogueExpanded: false, npcTextUpdateTimer: null, npcVariantFilter: 'human', ...ov };
  const renderService = { renderNpcs: vi.fn(), renderWorldGrid: vi.fn(), renderEditor: vi.fn() };
  const history = { pushCurrentState: vi.fn() };
  const gameEngine = {
    npcManager: { ensureDefaultNPCs: vi.fn(), getDefinitions: vi.fn(() => [{ type: 'villager' }, { type: 'elder' }]), createNPC: vi.fn((_t, _r) => ({ id: 'npc-new', type: _t, roomIndex: _r, placed: true })), removeNPC: vi.fn(() => true), setNPCPosition: vi.fn(() => true) },
    getSprites: vi.fn((): any[] => []),
    getVariableDefinitions: vi.fn(() => [{ id: 'var-1', name: 'Flag 1' }, { id: 'var-2', name: '' }]),
    draw: vi.fn(),
  };
  return { state, renderService, history, gameEngine, domCache: { editorCanvas: canvas }, enemyService: { deactivatePlacement: vi.fn() }, objectService: { togglePlacement: vi.fn() }, updateJSON: vi.fn() };
}
function makeService(ov: Record<string, any> = {}) { const m = makeManager(ov); return { service: new EditorNpcService(m as any), manager: m }; }
beforeEach(() => { vi.stubGlobal('alert', vi.fn()); });

describe('activatePlacement', () => {
  it('alerts when no selectedNpcId', () => { const {service} = makeService({selectedNpcId:null}); service.activatePlacement(); expect(alert).toHaveBeenCalledTimes(1); expect(service.state.placingNpc).toBe(false); });
  it('returns early when already placing', () => { const {service,manager} = makeService({selectedNpcId:'npc-1',placingNpc:true}); service.activatePlacement(); expect(manager.enemyService.deactivatePlacement).not.toHaveBeenCalled(); expect(service.state.placingNpc).toBe(true); });
  it('deactivates enemy placement', () => { const {service,manager} = makeService({selectedNpcId:'npc-1',placingNpc:false}); service.activatePlacement(); expect(manager.enemyService.deactivatePlacement).toHaveBeenCalledTimes(1); });
  it('deactivates object when set', () => { const {service,manager} = makeService({selectedNpcId:'npc-1',placingNpc:false,placingObjectType:'chest'}); service.activatePlacement(); expect(manager.objectService.togglePlacement).toHaveBeenCalledWith('chest',true); });
  it('no togglePlacement when no placingObjectType', () => { const {service,manager} = makeService({selectedNpcId:'npc-1',placingNpc:false,placingObjectType:null}); service.activatePlacement(); expect(manager.objectService.togglePlacement).not.toHaveBeenCalled(); });
  it('sets state flags', () => { const {service} = makeService({selectedNpcId:'npc-1',placingNpc:false,placingEnemy:true,placingObjectType:'barrel'}); service.activatePlacement(); expect(service.state.placingNpc).toBe(true); expect(service.state.placingEnemy).toBe(false); expect(service.state.placingObjectType).toBeNull(); });
  it('sets cursor crosshair', () => { const {service,manager} = makeService({selectedNpcId:'npc-1',placingNpc:false}); service.activatePlacement(); expect(manager.domCache.editorCanvas.style.cursor).toBe('crosshair'); });
});

describe('deactivatePlacement', () => {
  it('returns early when not placing', () => { const {service,manager} = makeService({placingNpc:false}); manager.domCache.editorCanvas.style.cursor='crosshair'; service.deactivatePlacement(); expect(manager.domCache.editorCanvas.style.cursor).toBe('crosshair'); expect(service.state.placingNpc).toBe(false); });
  it('sets placingNpc false', () => { const {service} = makeService({placingNpc:true}); service.deactivatePlacement(); expect(service.state.placingNpc).toBe(false); });
  it('resets cursor when no other placement', () => { const {service,manager} = makeService({placingNpc:true,placingEnemy:false,placingObjectType:null}); manager.domCache.editorCanvas.style.cursor='crosshair'; service.deactivatePlacement(); expect(manager.domCache.editorCanvas.style.cursor).toBe('default'); });
  it('no cursor reset when placingEnemy', () => { const {service,manager} = makeService({placingNpc:true,placingEnemy:true,placingObjectType:null}); manager.domCache.editorCanvas.style.cursor='crosshair'; service.deactivatePlacement(); expect(manager.domCache.editorCanvas.style.cursor).toBe('crosshair'); });
  it('no cursor reset when placingObjectType', () => { const {service,manager} = makeService({placingNpc:true,placingEnemy:false,placingObjectType:'chest'}); manager.domCache.editorCanvas.style.cursor='crosshair'; service.deactivatePlacement(); expect(manager.domCache.editorCanvas.style.cursor).toBe('crosshair'); });
});

describe('clearSelection', () => {
  it('returns false when nothing selected', () => { const {service} = makeService({selectedNpcId:null,selectedNpcType:null,placingNpc:false}); expect(service.clearSelection()).toBe(false); });
  it('returns true when selected', () => { const {service} = makeService({selectedNpcId:'npc-1'}); expect(service.clearSelection()).toBe(true); });
  it('clears state fields', () => { const {service} = makeService({selectedNpcId:'npc-1',selectedNpcType:'villager',conditionalDialogueExpanded:true}); service.clearSelection(); expect(service.state.selectedNpcId).toBeNull(); expect(service.state.selectedNpcType).toBeNull(); expect(service.state.conditionalDialogueExpanded).toBe(false); });
  it('no renderNpcs when render=false', () => { const {service,manager} = makeService({selectedNpcId:'npc-1'}); service.clearSelection({render:false}); expect(manager.renderService.renderNpcs).not.toHaveBeenCalled(); });
  it('calls renderNpcs when render=true and had selection', () => { const {service,manager} = makeService({selectedNpcId:'npc-1'}); service.clearSelection({render:true}); expect(manager.renderService.renderNpcs).toHaveBeenCalledTimes(1); });
  it('no renderNpcs when nothing selected', () => { const {service,manager} = makeService({selectedNpcId:null,selectedNpcType:null,placingNpc:false}); service.clearSelection({render:true}); expect(manager.renderService.renderNpcs).not.toHaveBeenCalled(); });
});

describe('addNpc', () => {
  it('alerts when all types occupied', () => { const {service,manager} = makeService({activeRoomIndex:0}); manager.gameEngine.getSprites.mockReturnValue([{type:'villager',roomIndex:0,placed:true},{type:'elder',roomIndex:0,placed:true}]); service.addNpc(); expect(alert).toHaveBeenCalledTimes(1); expect(manager.renderService.renderNpcs).not.toHaveBeenCalled(); });
  it('alerts when createNPC null', () => { const {service,manager} = makeService({activeRoomIndex:0}); manager.gameEngine.getSprites.mockReturnValue([]); manager.gameEngine.npcManager.createNPC.mockReturnValue(null as any); service.addNpc(); expect(alert).toHaveBeenCalledTimes(1); expect(manager.renderService.renderNpcs).not.toHaveBeenCalled(); });
  it('sets selectedNpcId on success', () => { const {service,manager} = makeService({activeRoomIndex:0}); manager.gameEngine.getSprites.mockReturnValue([]); service.addNpc(); expect(service.state.selectedNpcId).toBe('npc-new'); expect(service.state.selectedNpcType).toBe('villager'); });
  it('calls full render chain on success', () => { const {service,manager} = makeService({activeRoomIndex:0}); manager.gameEngine.getSprites.mockReturnValue([]); service.addNpc(); expect(manager.renderService.renderNpcs).toHaveBeenCalledTimes(1); expect(manager.renderService.renderWorldGrid).toHaveBeenCalledTimes(1); expect(manager.renderService.renderEditor).toHaveBeenCalledTimes(1); expect(manager.gameEngine.draw).toHaveBeenCalledTimes(1); expect(manager.updateJSON).toHaveBeenCalledTimes(1); expect(manager.history.pushCurrentState).toHaveBeenCalledTimes(1); });
  it('finds available type not in current room', () => { const {service,manager} = makeService({activeRoomIndex:1}); manager.gameEngine.getSprites.mockReturnValue([{type:'villager',roomIndex:0,placed:true}]); service.addNpc(); expect(manager.gameEngine.npcManager.createNPC).toHaveBeenCalledWith('villager',1); });
});

describe('removeSelectedNpc', () => {
  it('returns early when no selectedNpcId', () => { const {service,manager} = makeService({selectedNpcId:null}); service.removeSelectedNpc(); expect(manager.gameEngine.npcManager.removeNPC).not.toHaveBeenCalled(); });
  it('returns early when removeNPC false', () => { const {service,manager} = makeService({selectedNpcId:'npc-1'}); manager.gameEngine.npcManager.removeNPC.mockReturnValue(false); service.removeSelectedNpc(); expect(manager.renderService.renderNpcs).not.toHaveBeenCalled(); });
  it('clears and calls chain on success', () => { const {service,manager} = makeService({selectedNpcId:'npc-1'}); service.removeSelectedNpc(); expect(service.state.selectedNpcId).toBeNull(); expect(manager.renderService.renderNpcs).toHaveBeenCalled(); expect(manager.renderService.renderWorldGrid).toHaveBeenCalled(); expect(manager.renderService.renderEditor).toHaveBeenCalled(); expect(manager.gameEngine.draw).toHaveBeenCalled(); expect(manager.updateJSON).toHaveBeenCalled(); expect(manager.history.pushCurrentState).toHaveBeenCalled(); });
});

describe('updateNpcSelection', () => {
  it('calls clearSelection when id null', () => { const {service,manager} = makeService({selectedNpcId:'npc-1'}); service.updateNpcSelection(null,null); expect(service.state.selectedNpcId).toBeNull(); expect(manager.renderService.renderNpcs).toHaveBeenCalled(); });
  it('sets type and id', () => { const {service} = makeService(); service.updateNpcSelection('elder','npc-42'); expect(service.state.selectedNpcType).toBe('elder'); expect(service.state.selectedNpcId).toBe('npc-42'); });
  it('expanded=true when conditionText', () => { const {service,manager} = makeService(); manager.gameEngine.getSprites.mockReturnValue([{id:'npc-42',conditionText:'hi'}]); service.updateNpcSelection('villager','npc-42'); expect(service.state.conditionalDialogueExpanded).toBe(true); });
  it('expanded=true when conditionVariableId', () => { const {service,manager} = makeService(); manager.gameEngine.getSprites.mockReturnValue([{id:'npc-42',conditionVariableId:'var-1'}]); service.updateNpcSelection('villager','npc-42'); expect(service.state.conditionalDialogueExpanded).toBe(true); });
  it('expanded=true when conditionalRewardVariableId', () => { const {service,manager} = makeService(); manager.gameEngine.getSprites.mockReturnValue([{id:'npc-42',conditionalRewardVariableId:'var-2'}]); service.updateNpcSelection('villager','npc-42'); expect(service.state.conditionalDialogueExpanded).toBe(true); });
  it('expanded=false when no conditional data', () => { const {service,manager} = makeService(); manager.gameEngine.getSprites.mockReturnValue([{id:'npc-42',text:'hello'}]); service.updateNpcSelection('villager','npc-42'); expect(service.state.conditionalDialogueExpanded).toBe(false); });
});

describe('placeNpcAt', () => {
  it('alerts when no selectedNpcId', () => { const {service,manager} = makeService({selectedNpcId:null}); service.placeNpcAt({x:5,y:3}); expect(alert).toHaveBeenCalledTimes(1); expect(manager.renderService.renderNpcs).not.toHaveBeenCalled(); });
  it('alerts when setNPCPosition false', () => { const {service,manager} = makeService({selectedNpcId:'npc-1'}); manager.gameEngine.npcManager.setNPCPosition.mockReturnValue(false); service.placeNpcAt({x:2,y:4}); expect(alert).toHaveBeenCalledTimes(1); expect(manager.renderService.renderNpcs).not.toHaveBeenCalled(); });
  it('calls full chain on success', () => { const {service,manager} = makeService({selectedNpcId:'npc-1',activeRoomIndex:2}); service.placeNpcAt({x:7,y:8}); expect(manager.gameEngine.npcManager.setNPCPosition).toHaveBeenCalledWith('npc-1',7,8,2); expect(manager.renderService.renderNpcs).toHaveBeenCalled(); expect(manager.renderService.renderWorldGrid).toHaveBeenCalled(); expect(manager.renderService.renderEditor).toHaveBeenCalled(); expect(manager.gameEngine.draw).toHaveBeenCalled(); expect(manager.updateJSON).toHaveBeenCalled(); expect(manager.history.pushCurrentState).toHaveBeenCalled(); });
});

describe('populateVariableSelect', () => {
  it('no throw when null', () => { const {service} = makeService(); expect(() => service.populateVariableSelect(null)).not.toThrow(); });
  it('creates empty option first', () => { const {service} = makeService(); const sel=document.createElement('select'); service.populateVariableSelect(sel); expect(sel.options[0].value).toBe(''); });
  it('adds empty + var options', () => { const {service} = makeService(); const sel=document.createElement('select'); service.populateVariableSelect(sel); expect(sel.options.length).toBe(3); });
  it('uses id as text when name empty', () => { const {service} = makeService(); const sel=document.createElement('select'); service.populateVariableSelect(sel); const opt=Array.from(sel.options).find(o=>o.value==='var-2'); expect(opt!.textContent).toBe('var-2'); });
  it('sets value to selectedId', () => { const {service} = makeService(); const sel=document.createElement('select'); service.populateVariableSelect(sel,'var-1'); expect(sel.value).toBe('var-1'); });
  it('adds bard when includeBardSkill=true', () => { const {service} = makeService(); const sel=document.createElement('select'); service.populateVariableSelect(sel,'',{includeBardSkill:true}); expect(Array.from(sel.options).find(o=>o.value==='skill:bard')).toBeDefined(); });
  it('no bard when includeBardSkill=false', () => { const {service} = makeService(); const sel=document.createElement('select'); service.populateVariableSelect(sel,'',{includeBardSkill:false}); expect(Array.from(sel.options).find(o=>o.value==='skill:bard')).toBeUndefined(); });
});

describe('updateNpcText', () => {
  it('returns early when no selectedNpcId', () => { const {service,manager} = makeService({selectedNpcId:null}); service.updateNpcText('Hello'); expect(manager.renderService.renderNpcs).not.toHaveBeenCalled(); });
  it('returns early when npc not found', () => { const {service,manager} = makeService({selectedNpcId:'npc-99'}); manager.gameEngine.getSprites.mockReturnValue([]); service.updateNpcText('Hello'); expect(manager.renderService.renderNpcs).not.toHaveBeenCalled(); });
  it('sets text and clears textKey', () => { const npc={id:'npc-1',text:'',textKey:'key'}; const {service,manager} = makeService({selectedNpcId:'npc-1'}); manager.gameEngine.getSprites.mockReturnValue([npc]); service.updateNpcText('New'); expect(npc.text).toBe('New'); expect(npc.textKey).toBeNull(); });
  it('calls renderNpcs and updateJSON', () => { const npc={id:'npc-1',text:'',textKey:null}; const {service,manager} = makeService({selectedNpcId:'npc-1'}); manager.gameEngine.getSprites.mockReturnValue([npc]); service.updateNpcText('Hi'); expect(manager.renderService.renderNpcs).toHaveBeenCalled(); expect(manager.updateJSON).toHaveBeenCalled(); });
  it('sets timer via scheduleNpcTextUpdate', () => { vi.useFakeTimers(); const npc={id:'npc-1',text:'',textKey:null}; const {service,manager} = makeService({selectedNpcId:'npc-1'}); manager.gameEngine.getSprites.mockReturnValue([npc]); service.updateNpcText('Hi'); expect(service.state.npcTextUpdateTimer).not.toBeNull(); vi.useRealTimers(); });
});

describe('updateNpcConditionalText', () => {
  it('returns early when no selectedNpcId', () => { const {service,manager} = makeService({selectedNpcId:null}); service.updateNpcConditionalText('t'); expect(manager.renderService.renderNpcs).not.toHaveBeenCalled(); });
  it('sets conditionText', () => { const npc={id:'npc-1',conditionText:''}; const {service,manager} = makeService({selectedNpcId:'npc-1'}); manager.gameEngine.getSprites.mockReturnValue([npc]); service.updateNpcConditionalText('Cond'); expect(npc.conditionText).toBe('Cond'); expect(manager.renderService.renderNpcs).toHaveBeenCalled(); expect(manager.updateJSON).toHaveBeenCalled(); });
});

describe('handleConditionVariableChange', () => {
  it('returns early when no selectedNpcId', () => { const {service,manager} = makeService({selectedNpcId:null}); service.handleConditionVariableChange('v'); expect(manager.renderService.renderNpcs).not.toHaveBeenCalled(); });
  it('sets conditionVariableId', () => { const npc={id:'npc-1',conditionVariableId:null}; const {service,manager} = makeService({selectedNpcId:'npc-1'}); manager.gameEngine.getSprites.mockReturnValue([npc]); service.handleConditionVariableChange('var-1'); expect(npc.conditionVariableId).toBe('var-1'); expect(manager.renderService.renderNpcs).toHaveBeenCalled(); expect(manager.history.pushCurrentState).toHaveBeenCalled(); });
  it('sets to null on empty string', () => { const npc={id:'npc-1',conditionVariableId:'old'}; const {service,manager} = makeService({selectedNpcId:'npc-1'}); manager.gameEngine.getSprites.mockReturnValue([npc]); service.handleConditionVariableChange(''); expect(npc.conditionVariableId).toBeNull(); });
});

describe('handleRewardVariableChange', () => {
  it('sets rewardVariableId', () => { const npc={id:'npc-1',rewardVariableId:null}; const {service,manager} = makeService({selectedNpcId:'npc-1'}); manager.gameEngine.getSprites.mockReturnValue([npc]); service.handleRewardVariableChange('var-2'); expect(npc.rewardVariableId).toBe('var-2'); expect(manager.renderService.renderNpcs).toHaveBeenCalled(); expect(manager.history.pushCurrentState).toHaveBeenCalled(); });
  it('sets to null on empty string', () => { const npc={id:'npc-1',rewardVariableId:'old'}; const {service,manager} = makeService({selectedNpcId:'npc-1'}); manager.gameEngine.getSprites.mockReturnValue([npc]); service.handleRewardVariableChange(''); expect(npc.rewardVariableId).toBeNull(); });
});

describe('handleConditionalRewardVariableChange', () => {
  it('sets conditionalRewardVariableId', () => { const npc={id:'npc-1',conditionalRewardVariableId:null}; const {service,manager} = makeService({selectedNpcId:'npc-1'}); manager.gameEngine.getSprites.mockReturnValue([npc]); service.handleConditionalRewardVariableChange('var-1'); expect(npc.conditionalRewardVariableId).toBe('var-1'); expect(manager.renderService.renderNpcs).toHaveBeenCalled(); expect(manager.history.pushCurrentState).toHaveBeenCalled(); });
  it('sets to null on empty string', () => { const npc={id:'npc-1',conditionalRewardVariableId:'old'}; const {service,manager} = makeService({selectedNpcId:'npc-1'}); manager.gameEngine.getSprites.mockReturnValue([npc]); service.handleConditionalRewardVariableChange(''); expect(npc.conditionalRewardVariableId).toBeNull(); });
});

describe('setVariantFilter', () => {
  it('no-op when same variant', () => { const {service,manager} = makeService({npcVariantFilter:'elf'}); service.setVariantFilter('elf'); expect(manager.renderService.renderNpcs).not.toHaveBeenCalled(); expect(service.state.npcVariantFilter).toBe('elf'); });
  it('normalizes unknown to human', () => { const {service} = makeService({npcVariantFilter:'elf'}); service.setVariantFilter('unicorn'); expect(service.state.npcVariantFilter).toBe('human'); });
  it('sets known variant', () => { const {service} = makeService({npcVariantFilter:'human'}); service.setVariantFilter('dwarf'); expect(service.state.npcVariantFilter).toBe('dwarf'); });
  it('calls renderNpcs', () => { const {service,manager} = makeService({npcVariantFilter:'human'}); service.setVariantFilter('elf'); expect(manager.renderService.renderNpcs).toHaveBeenCalledTimes(1); });
  it('accepts elf dwarf fixed', () => { for (const v of ['elf','dwarf','fixed']) { const {service} = makeService({npcVariantFilter:'human'}); service.setVariantFilter(v); expect(service.state.npcVariantFilter).toBe(v); } });
});

