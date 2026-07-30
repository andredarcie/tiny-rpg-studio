import ts from 'typescript';
import { defineConfig, type Plugin } from 'vite';
import { isRuntimeTextKey } from './src/runtime/adapters/runtimeTextKeys';

function runtimeOnlyTranslations(): Plugin {
  return {
    name: 'runtime-only-translations',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replaceAll('\\', '/').endsWith('/src/runtime/adapters/TextResources.ts')) {
        return null;
      }

      const sourceFile = ts.createSourceFile(
        id,
        code,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      );
      let initializer: ts.ObjectLiteralExpression | null = null;
      sourceFile.forEachChild((node) => {
        if (!ts.isVariableStatement(node)) return;
        for (const declaration of node.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name) &&
              declaration.name.text === 'TEXT_BUNDLES' &&
              declaration.initializer &&
              ts.isObjectLiteralExpression(declaration.initializer)) {
            initializer = declaration.initializer;
          }
        }
      });
      if (!initializer) return null;

      const runtimeLocales = initializer.properties.map((localeProperty) => {
        if (!ts.isPropertyAssignment(localeProperty) ||
            !ts.isObjectLiteralExpression(localeProperty.initializer)) {
          return localeProperty;
        }
        const properties = localeProperty.initializer.properties.filter((property) => {
          if (!ts.isPropertyAssignment(property)) return false;
          const name = property.name;
          const key = ts.isStringLiteral(name) || ts.isIdentifier(name) ? name.text : '';
          return isRuntimeTextKey(key);
        });
        return ts.factory.updatePropertyAssignment(
          localeProperty,
          localeProperty.name,
          ts.factory.updateObjectLiteralExpression(localeProperty.initializer, properties),
        );
      });
      const replacement = ts.factory.updateObjectLiteralExpression(initializer, runtimeLocales);
      const printed = ts.createPrinter({ removeComments: false }).printNode(
        ts.EmitHint.Expression,
        replacement,
        sourceFile,
      );
      return {
        code: code.slice(0, initializer.getStart(sourceFile)) +
          printed +
          code.slice(initializer.getEnd()),
        map: null,
      };
    },
  };
}

export default defineConfig({
  base: './', // Paths relativos para compatibilidade com itch.io
  publicDir: false,
  esbuild: {
    drop: ['debugger'],
    pure: ['console.log', 'console.debug', 'console.info'],
  },
  build: {
    lib: {
      entry: 'src/export/main.ts',
      name: 'TinyRPGExport',
      formats: ['iife'],
      fileName: () => 'export.bundle.js',
      cssFileName: 'tiny-rpg-studio-sdk',
    },
    outDir: 'public',
    emptyOutDir: false,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  plugins: [runtimeOnlyTranslations()],
});
