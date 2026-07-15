type SpriteMatrix = (number | null)[][];

const ObjectSpriteMatrices: Record<string, SpriteMatrix> = {
    'player-start': [
        [ null, null, null, null, null, null, null, null ],
        [ null, null, null, null, null, null, null, null ],
        [ null, null,  3,  3,  3,  3, null, null ],
        [ null, null,  3,  3, 11,  3, null, null ],
        [ null, null,  3, 11,  3,  3, null, null ],
        [ null, null,  3,  3,  3,  3, null, null ],
        [ null, null, null, null, null, null, null, null ],
        [ null, null, null, null, null, null, null, null ]
    ],
    'player-end': [
        [ null, null, null, null, null, null, null, null ],
        [ null, null, null, null, null, null, null, null ],
        [ null, null,  2,  2,  2,  2, null, null ],
        [ null, null,  2,  2, 14,  2, null, null ],
        [ null, null,  2, 14,  2,  2, null, null ],
        [ null, null,  2,  2,  2,  2, null, null ],
        [ null, null, null, null, null, null, null, null ],
        [ null, null, null, null, null, null, null, null ]
    ],
    switch: [
        [ null, null, null, null, null, null, null, null ],
        [  8, null, null, null, null, null, null, null ],
        [ null,  6, null, null, null, null, null, null ],
        [ null, null,  6, null, null, null, null, null ],
        [ null, null, null,  6, null, null, null, null ],
        [ null, null,  6, null, null,  6, null, null ],
        [ null,  6,  6,  6,  6,  6,  6, null ],
        [ null, null, null, null, null, null, null, null ]
    ],
    'switch--on': [
        [ null, null, null, null, null, null, null, null ],
        [ null, null, null, null, null, null, null, 12 ],
        [ null, null, null, null, null, null,  6, null ],
        [ null, null, null, null, null,  6, null, null ],
        [ null, null, null, null,  6, null, null, null ],
        [ null, null,  6, null, null,  6, null, null ],
        [ null,  6,  6,  6,  6,  6,  6, null ],
        [ null, null, null, null, null, null, null, null ]
    ],
    key: [
        [ null, null, null, null, null, null, null, null ],
        [ null, null, null, null, null, null, null, null ],
        [ null, null, null, null, null, null, null, null ],
        [ 10, 10,  7, null, null, null, null, null ],
        [ 10, null, 10, 10, 10, 10, 10, 10 ],
        [  9,  9,  9, null, null,  9, null,  9 ],
        [ null, null, null, null, null, null, null, null ],
        [ null, null, null, null, null, null, null, null ]
    ],
    door: [
        [ null,  4,  4,  4,  4,  4,  4, null ],
        [  4,  9,  9,  9,  9,  9,  9,  4 ],
        [  4,  9,  9,  9,  9,  9,  9,  4 ],
        [  4,  9,  9,  9,  0,  0,  9,  4 ],
        [  4,  9,  9,  9,  0,  0,  9,  4 ],
        [  4,  9,  9,  9,  9,  0,  9,  4 ],
        [  4,  9,  9,  9,  9,  9,  9,  4 ],
        [  4,  9,  9,  9,  9,  9,  9,  4 ]
    ],
    'door-variable': [
        [ null,  7, null,  7, null,  7, null,  7 ],
        [ null,  6,  6,  6,  6,  6,  6,  6 ],
        [ null,  6, 13,  6, 13,  6, 13,  6 ],
        [ null,  6, null,  6, null,  6, null,  6 ],
        [ null,  6, null,  6, null,  6, null,  5 ],
        [ null,  6,  6,  6,  6,  6,  6,  6 ],
        [ null,  6, 13,  6, 13,  6, 13,  6 ],
        [ null,  6, null,  6, null,  6, null,  6 ]
    ],
    'life-potion': [
        [ null, null,  1,  1,  1,  1, null, null ],
        [ null,  1,  1,  1,  1,  1,  1, null ],
        [ null, null,  6, null, null,  6, null, null ],
        [ null, null,  6,  8,  8,  6, null, null ],
        [ null,  6,  8,  8,  8,  8,  6, null ],
        [  6,  8,  8,  8,  6,  8,  8,  6 ],
        [ null,  6,  8,  6,  8,  8,  6, null ],
        [ null, null,  6,  6,  6,  6, null, null ]
    ],
    'xp-scroll': [
        [ null, null,  6,  6,  6,  6,  6,  6 ],
        [ null, null,  6,  1,  1,  1,  6,  5 ],
        [ null, null,  6,  6,  6,  6,  6, null ],
        [ null, null,  6,  1,  1,  1,  6, null ],
        [ null, null,  6,  6,  6,  6,  6, null ],
        [ null, null,  6,  1,  1,  6,  6, null ],
        [ null,  6,  6,  6,  6,  6,  6, null ],
        [ null,  5,  5,  5,  5,  5,  5, null ]
    ],
    sword: [
        [ null, null, null, null, null, null, null, null ],
        [  6,  6, null, null, null, null, null, null ],
        [  6,  6,  6, null, null, null, null, null ],
        [ null,  6,  6,  6, null, null, null, null ],
        [ null, null,  6,  6,  6, null,  1, null ],
        [ null, null, null,  6,  8,  1,  1, null ],
        [ null, null, null, null,  1,  1, null, null ],
        [ null, null, null,  1,  1, null,  1, null ]
    ],
    'sword-bronze': [
        [ null, null, null, null, null, null, null, null ],
        [  9,  9, null, null, null, null, null, null ],
        [  9, 10,  9, null, null, null, null, null ],
        [ null,  9,  9, 10, null, null, null, null ],
        [ null, null,  9,  9, 10, null,  1, null ],
        [ null, null, null,  9,  9,  1,  1, null ],
        [ null, null, null, null,  1,  1, null, null ],
        [ null, null, null,  1,  1, null,  1, null ]
    ],
    'sword-wood': [
        [ null, null, null, null, null, null, null, null ],
        [  4,  4, null, null, null, null, null, null ],
        [  4,  5,  4, null, null, null, null, null ],
        [ null,  4,  4,  5, null, null, null, null ],
        [ null, null,  4,  4,  5, null,  1, null ],
        [ null, null, null,  4,  9,  1,  1, null ],
        [ null, null, null, null,  1,  1, null, null ],
        [ null, null, null,  1,  1, null,  1, null ]
    ],
    // NOT gate: triangle pointing right with a negation bubble at the tip
    'logic-gate-not': [
        [ null, null, null, null, null, null, null, null ],
        [ null,  6,  6, null, null, null, null, null ],
        [ null,  6,  6,  6,  6, null, null, null ],
        [ null,  6,  6,  6,  6,  6,  6,  7 ],
        [ null,  6,  6,  6,  6,  6,  6,  7 ],
        [ null,  6,  6,  6,  6, null, null, null ],
        [ null,  6,  6, null, null, null, null, null ],
        [ null, null, null, null, null, null, null, null ]
    ],
    // AND gate: flat left edge, rounded right (D shape)
    'logic-gate-and': [
        [ null, null, null, null, null, null, null, null ],
        [ null,  6,  6,  6,  6,  6, null, null ],
        [ null,  6,  6,  6,  6,  6,  6, null ],
        [ null,  6,  6,  6,  6,  6,  6, null ],
        [ null,  6,  6,  6,  6,  6,  6, null ],
        [ null,  6,  6,  6,  6,  6,  6, null ],
        [ null,  6,  6,  6,  6,  6, null, null ],
        [ null, null, null, null, null, null, null, null ]
    ],
    // OR gate: concave left edge, pointed right
    'logic-gate-or': [
        [ null, null, null, null, null, null, null, null ],
        [ null,  6,  6,  6, null, null, null, null ],
        [ null, null,  6,  6,  6,  6, null, null ],
        [ null, null,  6,  6,  6,  6,  6, null ],
        [ null, null,  6,  6,  6,  6,  6, null ],
        [ null, null,  6,  6,  6,  6, null, null ],
        [ null,  6,  6,  6, null, null, null, null ],
        [ null, null, null, null, null, null, null, null ]
    ],
    // NAND gate: AND body with a negation bubble at the output
    'logic-gate-nand': [
        [ null, null, null, null, null, null, null, null ],
        [ null,  6,  6,  6,  6,  6, null, null ],
        [ null,  6,  6,  6,  6,  6,  6, null ],
        [ null,  6,  6,  6,  6,  6,  6,  7 ],
        [ null,  6,  6,  6,  6,  6,  6,  7 ],
        [ null,  6,  6,  6,  6,  6,  6, null ],
        [ null,  6,  6,  6,  6,  6, null, null ],
        [ null, null, null, null, null, null, null, null ]
    ],
    // NOR gate: OR body with a negation bubble at the output
    'logic-gate-nor': [
        [ null, null, null, null, null, null, null, null ],
        [ null,  6,  6,  6, null, null, null, null ],
        [ null, null,  6,  6,  6,  6, null, null ],
        [ null, null,  6,  6,  6,  6,  6,  7 ],
        [ null, null,  6,  6,  6,  6,  6,  7 ],
        [ null, null,  6,  6,  6,  6, null, null ],
        [ null,  6,  6,  6, null, null, null, null ],
        [ null, null, null, null, null, null, null, null ]
    ],
    // LED off: dark grey circle
    'logic-led': [
        [ null, null, null, null, null, null, null, null ],
        [ null, null,  5,  5,  5,  5, null, null ],
        [ null,  5,  5,  5,  5,  5,  5, null ],
        [ null,  5,  5,  5,  5,  5,  5, null ],
        [ null,  5,  5,  5,  5,  5,  5, null ],
        [ null,  5,  5,  5,  5,  5,  5, null ],
        [ null, null,  5,  5,  5,  5, null, null ],
        [ null, null, null, null, null, null, null, null ]
    ],
    // LED on: bright yellow circle with light glow border
    'logic-led--on': [
        [ null, null, null, null, null, null, null, null ],
        [ null, null,  7, 10, 10,  7, null, null ],
        [ null,  7, 10, 10, 10, 10,  7, null ],
        [ null,  7, 10, 10, 10, 10,  7, null ],
        [ null,  7, 10, 10, 10, 10,  7, null ],
        [ null,  7, 10, 10, 10, 10,  7, null ],
        [ null, null,  7, 10, 10,  7, null, null ],
        [ null, null, null, null, null, null, null, null ]
    ],
    // Armor: silver breastplate with shoulder guards
    armor: [
        [ null, null, null, null, null, null, null, null ],
        [ null, null, null,  6,  6, null, null, null ],
        [ null,  6,  6,  6,  6,  6,  6, null ],
        [ null,  6,  6,  6,  6,  6,  6, null ],
        [ null, null,  6,  6,  6,  6, null, null ],
        [ null, null,  7,  5,  5,  7, null, null ],
        [ null, null,  6,  6,  6,  6, null, null ],
        [ null, null, null, null, null, null, null, null ]
    ],
    // Boots: brown boot silhouette
    boots: [
        [ null, null, null, null, null, null, null, null ],
        [ null, null, null, null, null, null, null, null ],
        [ null, null, null, null, null, null, null, null ],
        [ null, null, null, null, null, null, null, null ],
        [ null,  4, null, null, null,  4, null, null ],
        [ null,  4, 15, null, null,  4, 15, null ],
        [ null,  4,  4, null, null,  4,  4, null ],
        [ null, null, null, null, null, null, null, null ]
    ],
    // Trap inactive (variable ON)
    trap: [
        [ null, null, null, null, null, null, null, null ],
        [ null, null, null, null, null, null, null, null ],
        [ null, null,  6, null, null, null,  6, null ],
        [ null,  1,  1, null, null,  1,  1, null ],
        [ null, null, null, null, null, null, null, null ],
        [ null, null,  6, null, null, null,  6, null ],
        [ null,  1,  1, null, null,  1,  1, null ],
        [ null, null, null, null, null, null, null, null ]
    ],
    // Trap active (default, variable OFF)
    'trap--on': [
        [ null, null, null, null, null, null, null, null ],
        [ null, null, null, null, null, null, null, null ],
        [ null, null, null, null, null, null, null, null ],
        [ null,  5,  5, null, null,  5,  5, null ],
        [ null, null, null, null, null, null, null, null ],
        [ null, null, null, null, null, null, null, null ],
        [ null,  5,  5, null, null,  5,  5, null ],
        [ null, null, null, null, null, null, null, null ]
    ],
    // Push box: wooden crate (dark band is material, not a silhouette outline)
    'push-box': [
        [ null, null, null, null, null, null, null, null ],
        [ null, null, null, null, null, null, null, null ],
        [ null,  4,  4,  4,  4,  4, null, null ],
        [ null,  4,  5,  4,  5,  4, null, null ],
        [ null,  4,  4,  4,  4,  4, null, null ],
        [ null,  4,  5,  4,  5,  4, null, null ],
        [ null,  4,  4,  4,  4,  4, null, null ],
        [ null, null, null, null, null, null, null, null ]
    ],
    // Pressure plate: flat stone slab (inactive)
    'pressure-plate': [
        [ null, null, null, null, null, null, null, null ],
        [ null,  6,  6,  6,  6,  6,  6, null ],
        [ null,  6,  7,  7,  6,  6,  6, null ],
        [ null,  6,  7,  6,  6,  6,  6, null ],
        [ null,  6,  6,  6,  6,  6,  6, null ],
        [ null,  6,  6,  6,  6,  6,  6, null ],
        [ null, 13, 13, 13, 13, 13, 13, null ],
        [ null, null, null, null, null, null, null, null ]
    ],
    // Pressure plate: glowing blue when activated
    'pressure-plate--on': [
        [ null, null, null, null, null, null, null, null ],
        [ null, null, null, null, null, null, null, null ],
        [ null, 13, 13, 13, 13, 13, 13, null ],
        [ null, 13,  7,  7, 13, 13, 13, null ],
        [ null, 13,  7, 13, 13, 13, 13, null ],
        [ null, 13, 13, 13, 13, 13, 13, null ],
        [ null, 13, 13, 13, 13, 13, 13, null ],
        [ null, null, null, null, null, null, null, null ]
    ],
    // Chest: wooden box with gold clasp (closed)
    chest: [
        [ null, null, null, null, null, null, null, null ],
        [ null, null, null, null, null, null, null, null ],
        [ null,  9,  9,  9,  9,  9,  9, null ],
        [ null,  9,  4, 10, 10,  4,  9, null ],
        [ null,  9,  4,  4,  4,  4,  9, null ],
        [ null,  9,  4,  4,  4,  4,  9, null ],
        [ null,  9,  9,  9,  9,  9,  9, null ],
        [ null, null, null, null, null, null, null, null ]
    ],
    // Chest: open (lid raised, interior visible)
    'chest--on': [
        [ null, null, null, null, null, null, null, null ],
        [ null,  4,  4, 10, 10,  4,  4, null ],
        [ null,  4,  5,  5,  5,  5,  4, null ],
        [ null,  4,  5,  5,  5,  5,  4, null ],
        [ null,  9,  4,  4,  4,  4,  9, null ],
        [ null,  9,  4,  4,  4,  4,  9, null ],
        [ null,  9,  9,  9,  9,  9,  9, null ],
        [ null, null, null, null, null, null, null, null ]
    ]
};

export { ObjectSpriteMatrices };
