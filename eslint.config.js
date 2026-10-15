import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/test-results/**', '**/playwright-report/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    // The simulation must stay pure and deterministic (see CLAUDE.md).
    files: ['packages/sim/src/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-globals': ['error', 'window', 'document', 'performance'],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded RNG (rng.ts).' },
        { object: 'Date', property: 'now', message: 'Time is injected through a Clock.' },
      ],
      'no-restricted-imports': ['error', { patterns: ['three', 'three/*', 'react', 'react-dom'] }],
    },
  },
);
