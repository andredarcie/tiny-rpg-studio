export class PaletteGimpIO {
    // Parse GIMP .gpl text and return array of hex colors (#RRGGBB) in the order found
    static parseGpl(text: string): string[] {
        if (!text) return [];
        const lines = text.replace(/\r\n/g, '\n').split('\n');
        const colors: string[] = [];

        for (const raw of lines) {
            const line = raw.trim();
            if (!line || line.startsWith('#') || line.toLowerCase().startsWith('gimp palette') || line.toLowerCase().startsWith('name:') || line.toLowerCase().startsWith('columns:')) continue;
            const m = line.match(/^\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})/);
            if (!m) continue;
            const r = Math.max(0, Math.min(255, Number(m[1])));
            const g = Math.max(0, Math.min(255, Number(m[2])));
            const b = Math.max(0, Math.min(255, Number(m[3])));
            const hex = '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase();
            colors.push(hex);
        }

        return colors;
    }

    // Export 16-color palette into GIMP .gpl format
    static exportGpl(colors: string[]): string {
        const header = ['GIMP Palette', 'Name: Tiny RPG Studio export', 'Columns: 16', '#'];
        const lines = colors.slice(0, 16).map((hex) => {
            const h = (hex || '').replace('#', '');
            const num = parseInt(h, 16) || 0;
            const r = (num >> 16) & 0xff;
            const g = (num >> 8) & 0xff;
            const b = num & 0xff;
            return `${r.toString().padStart(3, ' ')} ${g.toString().padStart(3, ' ')} ${b.toString().padStart(3, ' ')}\t`;
        });
        return header.concat(lines).join('\n') + '\n';
    }
}

export default PaletteGimpIO;
