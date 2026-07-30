import { describe, expect, it } from 'vitest';
import { TextResources } from '../../runtime/adapters/TextResources';
import { isRuntimeTextKey } from '../../runtime/adapters/runtimeTextKeys';

describe('runtime translation keys', () => {
    it('keeps every runtime key translated in every supported locale', () => {
        const localeEntries = Object.entries(TextResources.bundles);
        const english = TextResources.getStrings(TextResources.defaultLocale);
        const runtimeKeys = Object.keys(english).filter(isRuntimeTextKey);

        expect(runtimeKeys.length).toBeGreaterThan(0);
        for (const [locale, bundle] of localeEntries) {
            expect(bundle, `${locale} bundle`).toBeDefined();
            for (const key of runtimeKeys) {
                expect(bundle, `${locale}:${key}`).toHaveProperty(key);
            }
        }
    });

    it('excludes editor-only skill controls', () => {
        expect(isRuntimeTextKey('skills.levelUpTitle')).toBe(true);
        expect(isRuntimeTextKey('skills.edit.modalTitle')).toBe(false);
        expect(isRuntimeTextKey('project.generateHTML')).toBe(false);
    });
});
