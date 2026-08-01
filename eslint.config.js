import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';

export default [
  {
    ignores: ['coverage/**', 'lib/**', 'docs/**', 'test/_demo_project/**', 'test/swagger/_example/**']
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
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
      'import/no-extraneous-dependencies': 'off'
      ,'no-prototype-builtins': 'off'
    }
  }
];