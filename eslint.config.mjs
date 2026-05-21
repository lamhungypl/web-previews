import js from '@eslint/js'
import perfectionist from 'eslint-plugin-perfectionist'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['dist', 'node_modules', 'public/sw.js'],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx,js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      perfectionist,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],

      'no-console': [
        'error',
        { allow: ['error', 'warn', 'debug', 'table', 'time', 'timeEnd'] },
      ],

      'perfectionist/sort-imports': [
        'error',
        {
          groups: [
            'side-effect',
            'builtin',
            'external',
            ['type-internal', 'internal'],
            ['parent', 'sibling', 'index'],
            'side-effect-style',
            ['unknown', 'style'],
          ],
          internalPattern: ['^@/.*'],
        },
      ],
      'perfectionist/sort-enums': ['error'],
      'perfectionist/sort-interfaces': ['error'],
      'perfectionist/sort-intersection-types': ['error'],
      'perfectionist/sort-object-types': ['error'],
      'perfectionist/sort-named-exports': ['error'],
      'perfectionist/sort-named-imports': ['error'],
    },
  },
  {
    files: ['scripts/**/*.{mjs,js}', 'eslint.config.mjs'],
    rules: {
      'no-console': 'off',
    },
  },
)
