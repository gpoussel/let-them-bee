import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default defineConfig(
  globalIgnores(['dist/**', 'public/**', '.vite/**']),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.js', '*.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      eqeqeq: ['error', 'always'],
      // Interpoler un nombre dans un texte est le quotidien d'un jeu incrémental.
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // Les gardes défensives sur les données chargées (sauvegarde, JSON) sont voulues.
      '@typescript-eslint/no-unnecessary-condition': 'off',
      // Phaser reçoit le contexte en argument explicite (`.on(evt, this.step, this)`).
      '@typescript-eslint/unbound-method': 'off',
      // Un callback qui ne fait rien (absorber un clic) est une intention, pas un oubli.
      '@typescript-eslint/no-empty-function': ['error', { allow: ['arrowFunctions'] }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'object-shorthand': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Les fichiers de configuration de la racine ne sont pas dans le projet TS.
    files: ['*.js', '*.ts'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
)
