import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'coverage/**',
      'lib/**',
      'dist/**',
      'docs/**',
      'test/_demo_project/**',
      'test/swagger/_example/**'
    ]
  },
  js.configs.recommended,
  //Scope the TS-specific rules to TS files so plain JS keeps its original lint behavior
  ...tseslint.configs.recommended.map(config => ({ ...config, files: ['**/*.ts'] })),
  {
    files: ['**/*.js', '**/*.ts'],
    plugins: {
      import: importPlugin
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true
        },
        node: true
      }
    },
    rules: {
      ...importPlugin.configs.recommended.rules,
      'import/no-unresolved': 'off',
      'import/extensions': ['error', 'always', { ignorePackages: true }],
      'no-console': 'off',
      'no-underscore-dangle': 'off',
      'no-continue': 'off',
      'no-await-in-loop': 'off',
      'class-methods-use-this': 'off',
      'no-restricted-syntax': 'off',
      'import/no-extraneous-dependencies': 'off',
      'no-prototype-builtins': 'off'
    }
  }
);
