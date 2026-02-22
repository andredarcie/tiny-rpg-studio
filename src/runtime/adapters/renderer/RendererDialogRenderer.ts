type DialogState = {
    active: boolean;
    text?: string;
    page?: number;
    maxPages?: number;
};

type DialogGameState = {
    getDialog: () => DialogState;
};

type PaletteManagerApi = {
    getColor: (index: number) => string;
};

class RendererDialogRenderer {
    gameState: DialogGameState;
    paletteManager: PaletteManagerApi;

    constructor(gameState: DialogGameState, paletteManager: PaletteManagerApi) {
        this.gameState = gameState;
        this.paletteManager = paletteManager;
    }

    drawDialog(ctx: CanvasRenderingContext2D, canvas: { width: number; height: number }) {
        const dialog = this.gameState.getDialog();
        if (!dialog.active || !dialog.text) return;
        if (!dialog.page || dialog.page < 1) {
            dialog.page = 1;
        }
        this.drawDialogBox(ctx, canvas, dialog);
    }

    drawDialogBox(ctx: CanvasRenderingContext2D, canvas: { width: number; height: number }, dialog: DialogState) {
        const pad = 4;
        const w = canvas.width - pad * 2;
        const h = 50;
        const x = pad;
        const y = canvas.height - h - pad;

        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(x, y, w, h);

        const accent = this.paletteManager.getColor(7) || "#FFF1E8";
        ctx.strokeStyle = accent;
        ctx.strokeRect(x, y, w, h);

        ctx.fillStyle = accent;
        ctx.font = "10px monospace";

        const lineHeight = 12;
        const maxWidth = w - 12;

        const pages = this.calculateDialogPages(dialog, ctx, maxWidth, lineHeight, h - 12);
        const totalPages = Math.max(1, pages.length);
        if (dialog.maxPages !== totalPages) {
            dialog.maxPages = totalPages;
        }
        const currentIndex = Math.min(Math.max((dialog.page ?? 1) - 1, 0), totalPages - 1);
        if (dialog.page !== currentIndex + 1) {
            dialog.page = currentIndex + 1;
        }
        const lines = pages[currentIndex] || [];

        let ty = y + 10;
        for (const line of lines) {
            ctx.fillText(line, x + 6, ty);
            ty += lineHeight;
        }
    }

    calculateDialogPages(
        dialog: DialogState,
        ctx: CanvasRenderingContext2D,
        maxWidth: number,
        lineHeight: number,
        boxHeight: number
    ) {
        const words = (dialog.text || '').split(/\s+/);
        let line = "";
        const lines = [];

        for (let i = 0; i < words.length; i++) {
            const testLine = line + words[i] + " ";
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && i > 0) {
                lines.push(line.trim());
                line = words[i] + " ";
            } else {
                line = testLine;
            }
        }
        lines.push(line.trim());

        const linesPerPage = Math.max(1, Math.floor(boxHeight / lineHeight));
        const pages = [];

        for (let i = 0; i < lines.length; i += linesPerPage) {
            pages.push(lines.slice(i, i + linesPerPage));
        }

        return pages;
    }
}

export { RendererDialogRenderer };

