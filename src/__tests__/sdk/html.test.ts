import { describe, expect, it } from 'vitest';
import { exportHtml } from '../../sdk/html';
import { TinyRPG } from '../../sdk';

describe('SDK HTML export', () => {
    it('keeps activation-only chest configuration in project JSON and share code', () => {
        const game = new TinyRPG();
        const variable = game.variable();
        game.room(0).addChest({ x: 2, y: 3, activatesVariable: variable });
        const project = game.toProjectData();
        const { html } = exportHtml(project, { runtimeJavaScript: '', css: '', fontDataUrl: 'data:font/woff;base64,AA==' });
        const document = new DOMParser().parseFromString(html, 'text/html');
        const json = document.getElementById('tiny-rpg-project')?.textContent;
        if (!json) throw Error('Missing bundled project');
        const embedded = JSON.parse(json) as { game: { objects: Array<{ activatesVariableId?: string }> } };
        expect(embedded.game.objects.find(object => object.activatesVariableId)?.activatesVariableId).toBe('var-1');
        expect(html).toContain(`globalThis.__TINY_RPG_SHARED_CODE=${JSON.stringify(TinyRPG.fromProjectData(project).toShareCode())};`);
    });
    it('embeds complete projects and escapes code, styles and multiplayer options', () => {
        const project = new TinyRPG().setTitle('<Tiny>').toProjectData();
        const result = exportHtml(project, { runtimeJavaScript: '/* </script> */', css: '/* </style> */', fontDataUrl: 'data:font/woff;base64,AA==', online: { partyHost: 'test', roomId: 'room', playerName: '</script><test>' } });
        const document = new DOMParser().parseFromString(result.html, 'text/html');
        expect(document.title).toBe('<Tiny>');
        expect(document.querySelector('test')).toBeNull();
        const json = document.getElementById('tiny-rpg-project')?.textContent;
        if (!json) throw Error('Missing bundled project');
        expect(JSON.parse(json)).toEqual({ game: project, plugins: [] });
        expect(document.getElementById('btn-open-studio')?.hasAttribute('hidden')).toBe(true);
        expect(result.html).toContain(`globalThis.__TINY_RPG_SHARED_CODE=${JSON.stringify(TinyRPG.fromProjectData(project).toShareCode())};`);
        expect(result.sections.total).toBe(new TextEncoder().encode(result.html).length);
    });
});
