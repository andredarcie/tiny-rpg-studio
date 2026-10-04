import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

async function declarations(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const file = join(directory, entry.name);
        if (entry.isDirectory()) await declarations(file);
        else if (entry.name.endsWith('.d.ts')) {
            const source = await readFile(file, 'utf8');
            const qualify = extension => source.replace(/((?:from\s+|import\()['"])(\.\.?\/[^'"]+)(['"])/g,
                (_match, prefix, specifier, suffix) => {
                    const base = specifier.replace(/\.(?:js|cjs)$/, '');
                    const target = existsSync(resolve(dirname(file), `${base}/index.d.ts`)) ? `${base}/index` : base;
                    return `${prefix}${target}.${extension}${suffix}`;
                });
            await writeFile(file, qualify('js'));
            await writeFile(file.replace(/\.d\.ts$/, '.d.cts'), qualify('cjs'));
        }
    }
}

await declarations('dist/sdk');
