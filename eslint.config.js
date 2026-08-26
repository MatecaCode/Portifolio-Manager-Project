import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // `design_handoff_sunnyheron_rebrand/` is a design drop, not app code: loose
  // JSX fragments that never get built or imported. Linting them buried the
  // handful of real findings in src/ under ~150 no-undef errors.
  globalIgnores(['dist', 'design_handoff_sunnyheron_rebrand']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
])
