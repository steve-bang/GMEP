import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  globalIgnores([
    '.next/**',
    'node_modules/**',
    'design/**',
    'docs/**',
    'next-env.d.ts',
    'test-results/**',
    'playwright-report/**',
    'tests/fixtures/**',
    'scripts/screenshot-all.js',
  ]),
  {
    rules: {
      // Money is integer VND (RULE-010 / NFR): forbid float-ish parsing of money by convention.
      'no-restricted-globals': [
        'error',
        {
          name: 'parseFloat',
          message: 'Money/quantities must not use floats; use integer VND or decimal.js.',
        },
      ],
    },
  },
  {
    // ADR 0001 R-12: nothing in the browser may import Firebase.
    files: ['src/ui/**', 'src/app/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: ['firebase', 'firebase/*', '@firebase/*', 'firebase-admin', 'firebase-admin/*'],
        },
      ],
    },
  },
]);
