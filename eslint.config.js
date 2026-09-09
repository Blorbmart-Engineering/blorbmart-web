import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'public/sw.js']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      /**
       * Warn, not error.
       *
       * Every occurrence is the same shape: a screen mounts, an effect calls
       * an async loader, and the loader flips a loading flag before it
       * awaits. That costs at most one extra render on a manual refresh —
       * the flag already starts true on mount — and the alternative
       * (threading a reducer through thirteen screens) buys nothing a
       * customer can perceive. Left visible so a genuinely cascading
       * setState still gets noticed in review.
       */
      'react-hooks/set-state-in-effect': 'warn',

      /**
       * Warn, not error.
       *
       * This governs how granular hot reload can be, not correctness. A few
       * modules deliberately export a component alongside the helper that
       * belongs with it — `showToast` next to the screen chrome it is styled
       * to match, `staggerFor` next to the motion primitives it feeds,
       * `hasOnboarded` next to the screen that sets the flag. Splitting those
       * would scatter one idea across two files to buy slightly faster HMR.
       */
      'react-refresh/only-export-components': 'warn',
    },
  },
  {
    // Build scripts run in Node, not the browser, and are not React.
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
])
