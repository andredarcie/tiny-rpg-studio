type SpriteMatrix = (number | null)[][];

const PlayerSpriteMatrices: Record<string, SpriteMatrix> = {
    default: [
        [ null, null, null, null, null, null, null, null ],
        [ null, null, 15, 15, 15, 15, null, null ],
        [ null,  6, 15, 12, 15, 12, null, null ],
        [ null,  6, 15, 15, 15, 15, null, null ],
        [ null,  9,  9,  4,  4,  9,  9, null ],
        [ null, 15,  9,  9,  9,  4, 15, null ],
        [ null, null,  5,  5,  5,  5, null, null ],
        [ null, null,  5, null, null,  5, null, null ]
    ]
};

export { PlayerSpriteMatrices };
