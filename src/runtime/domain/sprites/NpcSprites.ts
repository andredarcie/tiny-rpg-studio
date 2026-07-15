type SpriteMatrix = (number | null)[][];

const NpcSpriteMatrices: Record<string, SpriteMatrix> = {
    default: [
        [ null, null, null,  5,  5,  5, null, null ],
        [ null, null,  5,  5,  5,  5,  5, null ],
        [ null, null,  7,  1,  7,  1,  7, null ],
        [  5, null,  7,  7,  7,  7,  7, null ],
        [  5, null,  5,  5,  5,  5,  5, null ],
        [  5,  7,  6,  5,  5,  5,  6, null ],
        [  5, null,  6,  6,  5,  6,  6, null ],
        [  5, null,  6,  6,  6,  6,  6, null ]
    ],
    'default-elf': [
        [ null, null, null, 11, 11, 11, null, null ],
        [ null, null, 11,  7, 11,  7, 11, null ],
        [ null, null, 10,  1, 10,  1, 10, null ],
        [ 11, null, 10, 11, 11, 10, 11, null ],
        [ 11, null, 10,  7,  7, 10, 10, null ],
        [ 11, 10, 11, 10, 10, 11, 10, null ],
        [ 11, null, 10, 10, 11, 10, 10, null ],
        [ 11, null, 10, 10, 10, 10, 10, null ]
    ],
    'default-dwarf': [
        [ null, null, null,  4,  4,  4, null, null ],
        [ null, null,  4,  4,  4,  4,  4, null ],
        [ null, null,  9,  9,  9,  9,  9, null ],
        [  4, null,  9,  4,  4,  9,  4, null ],
        [  4, null,  9,  4,  4,  9,  4, null ],
        [  4,  9,  4,  9,  4,  9,  4, null ],
        [  4, null,  9,  9,  4,  9,  9, null ],
        [  4, null,  9,  9,  9,  9,  9, null ]
    ],
    'old-mage': [
        [ null, null, null, null, null, null, null, null ],
        [ null,  4,  6,  6,  6,  6, null, null ],
        [ null,  4, 15, 12, 15, 12, null, null ],
        [ null,  4, 15, 15, 15, 15,  5, null ],
        [ null, 15,  5,  6,  6,  6, 15, null ],
        [ null,  4,  5,  6,  6,  6, null, null ],
        [ null,  4,  5,  5,  6,  6, null, null ],
        [ null,  4,  5,  5,  5,  5, null, null ]
    ],
    'old-mage-elf': [
        [ null, 15, 10, 10, 10, 10, 15, null ],
        [ null, 15, 15, 12, 15, 12, 15, null ],
        [ null,  4, 15, 15, 15, 15, null, null ],
        [ null,  4, 10, 10, 10, 10,  5, null ],
        [ null,  4,  5, 10, 10, 10,  5, null ],
        [ null, 15,  5,  5, 10, 10, 15, null ],
        [ null,  4,  5,  5,  5,  5, null, null ],
        [ null,  4,  5,  5,  5,  5, null, null ]
    ],
    'old-mage-dwarf': [
        [ null, null, null, null, null, null, null, null ],
        [ null,  2, null, null, null, null, null, null ],
        [ null,  4,  6,  6,  6,  6, null, null ],
        [ null,  4, 15,  9, 15,  9, null, null ],
        [ null,  4, 15, 15, 15, 15, null, null ],
        [ null,  4,  5,  6,  6,  6,  5, null ],
        [ null, 15,  5,  5,  6,  6, 15, null ],
        [ null,  4, 13, null, null, 13, null, null ]
    ],
    'villager-man': [
        [ null, null, null, null, null, null, null, null ],
        [ null, null, 15, 15, 15, 15, null, null ],
        [ null, null, 15, 12, 15, 12, null, null ],
        [ null, null, 15, 15, 15, 15, null, null ],
        [ null,  4,  4,  4,  4,  4,  4, null ],
        [ null, 15,  4,  4,  4,  4, 15, null ],
        [ null, null,  9,  9,  9,  9, null, null ],
        [ null, null,  9, null, null,  9, null, null ]
    ],
    'villager-man-elf': [
        [ null, 15, 10, 10, 10, 10, 15, null ],
        [ null, 10, 15, 12, 15, 12, 10, null ],
        [ null, null, 15, 15, 15, 15, null, null ],
        [ null, 11, 11,  9,  9, 11, 11, null ],
        [ null, 11, 11, 11,  9, 11, 11, null ],
        [ null, 15, 11, 11,  9, 11, 15, null ],
        [ null, null, 11, 11,  9, 11, null, null ],
        [ null, null, 11, 11,  9, 11, null, null ]
    ],
    'villager-man-dwarf': [
        [ null, null, null, null, null, null, null, null ],
        [ null, null, null, null, null, null, null, null ],
        [ null, null,  5,  5,  5,  5, null, null ],
        [ null, null, 15,  9, 15,  9, null, null ],
        [ null, null, 15, 15, 15, 15, null, null ],
        [ null,  4,  4,  5,  5,  5,  4, null ],
        [ null, 15,  4,  4,  5,  5, 15, null ],
        [ null, null,  9, null, null,  9, null, null ]
    ],
    'villager-woman': [
        [ null, null, null, null, null, null, null, null ],
        [ null, null,  4,  4,  4,  4, null, null ],
        [ null, null,  4, 12, 15, 12, null, null ],
        [ null, null,  4, 15, 15, 15, null, null ],
        [ null, 14,  4, 14, 14, 14, 14, null ],
        [ null, 15,  4, 14, 14, 14, 15, null ],
        [ null, null, 14, 14, 14, 14, null, null ],
        [ null, null, 14, 14, 14, 14, null, null ]
    ],
    'villager-woman-elf': [
        [ null, 15, 10, 10, 10, 10, 15, null ],
        [ null, 10, 15, 12, 15, 12, 10, null ],
        [ null, 10, 15, 15, 15, 15, 10, null ],
        [ null, 10, 10,  9, 15, 10, 10, null ],
        [ null, 11, 10, 11,  9, 10, 11, null ],
        [ null, 15, 11, 11,  9, 11, 15, null ],
        [ null, null, 11, 11,  9, 11, null, null ],
        [ null, 11, 11, 11,  9, 11, 11, null ]
    ],
    'villager-woman-dwarf': [
        [ null, null, null, null, null, null, null, null ],
        [ null, null, null, null, null, null, null, null ],
        [ null, null,  5,  5,  5,  5, null, null ],
        [ null,  5, 15,  9, 15,  9, null, null ],
        [ null,  5, 15, 15, 15, 15, null, null ],
        [ null,  4,  5,  4,  4,  4,  4, null ],
        [ null, 15,  5,  4,  4,  4, 15, null ],
        [ null, null,  4,  4,  4,  4, null, null ]
    ],
    'child': [
        [ null, null, null, null, null, null, null, null ],
        [ null, null, null, null, null, null, null, null ],
        [ null, null, null, null, null, null, null, null ],
        [ null, null, 15, 15, 15, 15, null, null ],
        [ null, null, 15, 12, 15, 12, null, null ],
        [ null,  9,  9,  9,  9,  9,  9, null ],
        [ null, 15,  9,  9,  9,  9, 15, null ],
        [ null, null,  2, null, null,  2, null, null ]
    ],
    'child-elf': [
        [ null, null, null, null, null, null, null, null ],
        [ null, null, null, null, null, null, null, null ],
        [ null, null, 10, 10, 10, 10, null, null ],
        [ null, null, 15, 12, 15, 12, null, null ],
        [ null, null, 15, 15, 15, 15, null, null ],
        [ null, 11, 11, 11, 11, 11, 11, null ],
        [ null, 15, 11, 11, 11, 11, 15, null ],
        [ null, null,  9, null, null,  9, null, null ]
    ],
    'child-dwarf': [
        [ null, null, null, null, null, null, null, null ],
        [ null, null, null, null, null, null, null, null ],
        [ null, null, null, null, null, null, null, null ],
        [ null, null, null, null, null, null, null, null ],
        [ null, null, 15,  9, 15,  9, null, null ],
        [ null, null, 15, 15, 15, 15, null, null ],
        [ null, 15, 13, 13, 13, 13, 15, null ],
        [ null, null,  2, null, null,  2, null, null ]
    ],
    'king': [
        [ null, 10, null, 10, null, 10, null, null ],
        [ null,  9,  9,  9,  9,  9, null, 10 ],
        [ null, 15, 15, 12, 15, 12,  1,  9 ],
        [ null, 15, 15, 15, 15, 15,  1,  9 ],
        [ null,  8,  7, 15, 15,  7,  1,  9 ],
        [ null,  8,  8,  7,  8,  8,  8, 15 ],
        [ null,  8,  8,  7,  8,  8, null,  9 ],
        [ null,  7,  7,  7,  7,  7, null,  9 ]
    ],
    'king-elf': [
        [ 15, 10,  9, 10,  9, 10, null, 10 ],
        [ 15, 10, 15, 12, 15, 12, null,  9 ],
        [ null, 10, 15, 15, 15, 15,  1,  9 ],
        [ null, 11,  9, 15, 15,  9,  1,  9 ],
        [ null, 11, 11, 15, 11, 11, 11, 15 ],
        [ null, 11, 11, 10, 11, 11,  1,  9 ],
        [ null, 11, 11, 10, 11, 11, null,  9 ],
        [ null, 10, 10, 10, 10, 10, null,  9 ]
    ],
    'king-dwarf': [
        [ null, null, null, null, null, null, null, null ],
        [ null, 10,  9, 10,  9, 10, null, null ],
        [ null,  9,  9,  9,  9,  9, null, 10 ],
        [ null,  5, 15,  9, 15,  9,  1,  9 ],
        [ null,  5, 15, 15, 15, 15,  1,  9 ],
        [ null,  4,  4,  5,  5,  5,  4, 15 ],
        [ null,  4,  4,  9,  4,  4, null,  9 ],
        [ null,  9,  9,  9,  9,  9, null,  9 ]
    ],
    'knight': [
        [ null, null, null, null, null, null, null, null ],
        [ null, null,  6,  6,  6,  6, null, null ],
        [ null, null,  6, 12, 15, 12, null, null ],
        [ null, null,  6,  6,  6,  6, null, null ],
        [ null,  5,  5,  6,  6,  5,  5, null ],
        [ null,  6,  5,  5,  5,  5,  6, null ],
        [ null, null,  6,  6,  6,  6, null, null ],
        [ null, null,  6, null, null,  6, null, null ]
    ],
    'knight-elf': [
        [ null, 15, 10, 10, 10, 10, null, null ],
        [ null, 15, 10, 12, 15, 12, null, null ],
        [ null,  4, 11, 15, 15, 15, null, null ],
        [  4, 11, 11, 15, 15, 11, 11, null ],
        [ null, 11, 11, 11, 15, 11, 11, null ],
        [ null, 15, 11, 11, 11, 11, 15, null ],
        [ null, null, 11, 11, 11, 11,  4, null ],
        [ null, null, 11, null, null, 11, null, null ]
    ],
    'knight-dwarf': [
        [ null, null, null, null, null, null, null, null ],
        [ null, null, null, null, null, null, null, null ],
        [ null, null,  4,  4,  4,  4, null, null ],
        [ null, null,  4,  9, 15,  9, null, null ],
        [ null,  4,  4,  4,  4,  4,  4, null ],
        [ null,  5,  4,  4,  4,  4,  5, null ],
        [ null, null,  9,  9,  9,  9, null, null ],
        [ null, null,  9, null, null,  9, null, null ]
    ],
    'thief': [
        [ null, null, null, null, null, null, null, null ],
        [ null, null,  5,  5,  5,  5, null, null ],
        [ null, null,  5, 12, 15, 12, null, null ],
        [ null, null,  5,  5,  5,  5, null, null ],
        [ null,  5,  5,  5,  5,  5,  5, null ],
        [ null, 15,  5,  5,  5,  5, 15, null ],
        [ null, null, 13, 13, 13, 13, null, null ],
        [ null, null, 13, null, null, 13, null, null ]
    ],
    'thief-elf': [
        [ null, 15, 10, 10, 10, 10, 15, null ],
        [ null, 15, 10, 12, 15, 12, 15, null ],
        [ null, 10, 15, 15, 15, 15, 10, null ],
        [ null,  3,  5,  5,  5,  5,  3, null ],
        [ null,  5,  5,  5,  5,  5,  5, null ],
        [ null,  0,  5,  5,  5,  5,  0, null ],
        [ null, 10,  5,  5,  5,  5, 10, null ],
        [ null, null,  5, null, null,  5, null, null ]
    ],
    'thief-dwarf': [
        [ null, null, null, null, null, null, null, null ],
        [ null, null, null, null, null, null, null, null ],
        [ null, null,  5,  5,  5,  5, null, null ],
        [ null, null,  5,  9, 15,  9, null, null ],
        [ null,  5,  5,  5,  5,  5,  5, null ],
        [ null, 15,  5,  5,  5,  5, 15, null ],
        [ null, null,  4,  4,  4,  4, null, null ],
        [ null, null,  4, null, null,  4, null, null ]
    ],
    'blacksmith': [
        [ null, null, null, null, null, null, null, null ],
        [ null, null, 15, 15, 15, 15, null, null ],
        [ null, null, 15, 12, 15, 12, null, null ],
        [ null, null, 15, 15, 15, 15, null, null ],
        [ null,  6,  4,  6,  6,  4,  6, null ],
        [ null, 15,  4,  4,  4,  4, 15, null ],
        [ null, null,  4,  4,  4,  4, null, null ],
        [ null, null,  5, null, null,  5, null, null ]
    ],
    'blacksmith-elf': [
        [ null, 15, 10, 10, 10, 10, null, null ],
        [ null, 15, 10, 12, 15, 12, null, null ],
        [ null, 10, 15, 15, 15, 15, null, null ],
        [ null,  6, 11,  6,  6, 11,  6, null ],
        [ null,  6, 11, 11, 11, 11,  6, null ],
        [ null, 15, 11, 11, 11, 11, 15, null ],
        [ null, null, 11, 11, 11, 11, null, null ],
        [ null, null, 11, null, null, 11, null, null ]
    ],
    'blacksmith-dwarf': [
        [ null, null, null, null, null, null, null, null ],
        [ null, null, null, null, null, null, null, null ],
        [ null, null,  5,  5,  5,  5, null, null ],
        [ null, null, 15,  9, 15,  9, null, null ],
        [ null, null,  5, 15, 15, 15, null, null ],
        [ null,  6,  4,  5,  5,  5,  6, null ],
        [ null, 15,  4,  4,  5,  5, 15, null ],
        [ null, null,  4, null, null,  4, null, null ]
    ],
    'wooden-sign': [
        [ null, null, null, null, null, null, null, null ],
        [ null,  4,  4,  4,  4,  4,  4, null ],
        [ null,  4,  5,  5,  5,  5,  4, null ],
        [ null,  4,  4,  4,  4,  4,  4, null ],
        [ null,  4,  5,  5,  5,  4,  4, null ],
        [ null,  4,  4,  4,  4,  4,  4, null ],
        [ null,  4, null, null, null, null,  4, null ],
        [ null,  4, null, null, null, null,  4, null ]
    ],
    'thought-bubble': [
        [ null, null, null, null, null, null, null, null ],
        [ null,  6,  6,  6,  6,  6,  6, null ],
        [ null,  6,  1,  1,  1,  1,  6, null ],
        [ null,  6,  6,  6,  6,  6,  6, null ],
        [ null,  6,  1,  1,  1,  6,  6, null ],
        [ null,  6,  6,  6,  6,  6,  6, null ],
        [ null, null,  6,  6, null, null, null, null ],
        [ null, null,  6, null, null, null, null, null ]
    ]
};

export { NpcSpriteMatrices };
