const RUNTIME_TEXT_PREFIXES = [
    'aria.fullscreen',
    'combat.',
    'dialog.choice.',
    'doors.',
    'enemies.',
    'enemy.',
    'gameOver.',
    'hud.',
    'intro.',
    'npc.defaultName',
    'npcs.dialog.',
    'npcs.names.',
    'objects.item.',
    'objects.label.',
    'objects.status.',
    'player.',
    'skills.',
    'touchControls.',
    'variables.names.',
] as const;

function isRuntimeTextKey(key: string): boolean {
    if (key.startsWith('skills.edit.')) return false;
    return RUNTIME_TEXT_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export { isRuntimeTextKey, RUNTIME_TEXT_PREFIXES };
