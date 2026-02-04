export class StubGameState {
  state = { game: { title: 'Unit Test', author: 'Tester' } }
  resetCalled = false
  importedData: unknown = null
  setGameOverCalls: Array<{ value: boolean; reason?: string }> = []
  pauseCalls: string[] = []
  resumeCalls: string[] = []
  variableDefinitions: Array<{ id: string }> = [{ id: 'var-1' }]
  variables: Record<string, boolean> = { 'var-1': false }
  playerRoomIndex = 2
  objects: unknown[] = []
  objectsByRoom = new Map<number, unknown[]>()
  canResetAfterGameOver = true
  necromancerReady = false
  reviveResult = false
  levelUpOverlay = { active: false, cursor: 0, choices: [] as Array<{ id: string; nameKey?: string }> }
  pendingLevelUpChoices = 0
  selectedLevelUpIndex: number | null = null
  testSettings = { startLevel: 1, skills: [] as string[], godMode: false }
  maxPlayerLevel = 5
  enemyVariableCalls: Array<{ enemyId: string; variableId: string | null }> = []
  enemyVariableResult = true
  pickupOverlayActive = false
  levelUpCelebrationActive = false
  gameOver = false

  getGame() {
    return this.state.game
  }

  getState() {
    return this.state
  }

  resetGame() {
    this.resetCalled = true
  }

  exportGameData() {
    return { ok: true }
  }

  importGameData(data: unknown) {
    this.importedData = data
  }

  setGameOver(value: boolean, reason?: string) {
    this.setGameOverCalls.push({ value, reason })
    this.gameOver = value
  }
  isGameOver() {
    return this.gameOver
  }

  getPlayer() {
    return { roomIndex: this.playerRoomIndex }
  }

  getVariableDefinitions() {
    return this.variableDefinitions
  }

  getVariables() {
    return this.variables
  }

  setVariableValue(variableId: string, value: boolean, _isDefault: boolean) {
    const current = this.variables[variableId]
    this.variables[variableId] = Boolean(value)
    return [current !== value, null]
  }

  isVariableOn(variableId: string) {
    return Boolean(this.variables[variableId])
  }

  getObjects() {
    return this.objects
  }

  getObjectsForRoom(roomIndex: number) {
    return this.objectsByRoom.get(roomIndex) || []
  }

  setObjectPosition(type: string, roomIndex: number, x: number, y: number) {
    const entry = { type, roomIndex, x, y }
    const roomObjects = this.objectsByRoom.get(roomIndex) || []
    roomObjects.push(entry)
    this.objectsByRoom.set(roomIndex, roomObjects)
    return entry
  }

  setObjectVariable(type: string, roomIndex: number, variableId: string | null) {
    return { type, roomIndex, variableId }
  }

  setPlayerEndText(_roomIndex: number, text: string) {
    return text.trim()
  }

  getPlayerEndText() {
    return ''
  }

  removeObject() {}

  getKeys() {
    return 0
  }

  setEnemyVariable(enemyId: string, variableId: string | null) {
    this.enemyVariableCalls.push({ enemyId, variableId })
    return this.enemyVariableResult
  }

  prepareNecromancerRevive() {
    return this.necromancerReady
  }

  hasNecromancerReviveReady() {
    return this.necromancerReady
  }

  reviveFromNecromancer() {
    return this.reviveResult
  }

  getLevelUpOverlay() {
    return this.levelUpOverlay
  }

  getPendingLevelUpChoices() {
    return this.pendingLevelUpChoices
  }

  isLevelUpOverlayActive() {
    return this.levelUpOverlay.active
  }

  moveLevelUpCursor(delta: number) {
    this.levelUpOverlay.cursor += delta
  }

  selectLevelUpSkill(index: number | null) {
    const choices = this.levelUpOverlay.choices
    const targetIndex = index ?? 0
    this.selectedLevelUpIndex = targetIndex
    return choices[targetIndex] || null
  }

  isPickupOverlayActive() {
    return this.pickupOverlayActive
  }

  hidePickupOverlay() {
    this.pickupOverlayActive = false
  }

  isLevelUpCelebrationActive() {
    return this.levelUpCelebrationActive
  }

  hideLevelUpCelebration() {
    this.levelUpCelebrationActive = false
  }

  pauseGame(reason: string) {
    this.pauseCalls.push(reason)
  }

  resumeGame(reason: string) {
    this.resumeCalls.push(reason)
  }

  getTestSettings() {
    return this.testSettings
  }

  setTestSettings(settings: { startLevel?: number; skills?: string[]; godMode?: boolean }) {
    this.testSettings = {
      startLevel: settings.startLevel ?? this.testSettings.startLevel,
      skills: settings.skills ?? this.testSettings.skills,
      godMode: settings.godMode ?? this.testSettings.godMode
    }
  }

  getMaxPlayerLevel() {
    return this.maxPlayerLevel
  }

  getNow() {
    return performance.now()
  }
}
