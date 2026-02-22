import { vi } from 'vitest';

const noop = () => {};

const createContext2D = () => ({
    canvas: document.createElement('canvas'),
    fillRect: noop,
    clearRect: noop,
    getImageData: () => ({ data: new Uint8ClampedArray(), width: 0, height: 0 }),
    putImageData: noop,
    drawImage: noop,
    createImageData: () => ({ data: new Uint8ClampedArray(), width: 0, height: 0 }),
    save: noop,
    restore: noop,
    translate: noop,
    scale: noop,
    rotate: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    stroke: noop,
    fill: noop,
    arc: noop,
    rect: noop,
    strokeRect: noop,
    measureText: (text: string) => ({ width: text.length * 6 }),
    fillText: noop,
    strokeText: noop,
    setTransform: noop,
    resetTransform: noop,
    getContextAttributes: () => ({}),
    imageSmoothingEnabled: false,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1
});

if (typeof HTMLCanvasElement !== 'undefined') {
    // Prevent jsdom "Not implemented" errors for canvas contexts in tests.
    HTMLCanvasElement.prototype.getContext = vi.fn(() => createContext2D()) as unknown as HTMLCanvasElement['getContext'];
}
