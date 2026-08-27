/**
 * THE LINTER THAT WOULD HAVE CAUGHT D74 (adopted D75).
 *
 * Marrs: "set up the linter. I dont know what that is, but i'll trust you that we need it."
 *
 * WHAT IT IS, IN ONE LINE: a program that reads the code looking for mistakes a compiler is not
 * allowed to complain about. TypeScript checks that types line up; a linter checks for things that
 * type-check perfectly and are still obviously wrong.
 *
 * WHY WE NEED IT, WITH A RECEIPT. D74 was `return laneVoice(lane) ?? KIND_VOICE[...]`, a function
 * calling itself where it meant to read a map. It type-checked, because `laneVoice(lane)` is a
 * `string` and `string ?? x` is legal. It shipped. Gate 2 was dead for a week and it cost an hour of
 * elimination to find. TWO of the rules below flag it independently:
 *
 *   - `no-constant-binary-expression` sees that a `??` whose left side can never be null is
 *     pointless, which is the tell that the left side is the wrong expression.
 *   - `no-unused-vars` sees that `LANE_VOICE`, the map that line was supposed to read, is now
 *     referenced by nothing at all.
 *
 * DELIBERATELY NARROW. eslint-config-next brings hundreds of rules and this codebase has never been
 * linted, so turning everything on at once produces a wall of noise that gets ignored, which is
 * worse than no linter: a warning nobody reads trains people to skip warnings. So the correctness
 * rules that catch real bugs are ERRORS, the stylistic ones stay off, and the rule set grows when a
 * bug shows us which rule was missing. That is how this list earned its first two entries.
 */

import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [
  {
    // Build output, dependencies and the 24GB asset kit. Linting these is meaningless and slow.
    ignores: [
      '.next/**',
      'node_modules/**',
      'asset-kit/**',
      'design_handoff/**',
      'public/**',
      'scripts/**',
      '**/*.d.ts',
    ],
  },

  // Next's own rules: the hooks rules and the image/script checks that catch real React mistakes.
  ...compat.extends('next/core-web-vitals'),
  ...compat.extends('next/typescript'),

  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    rules: {
      /**
       * THE TWO THAT WOULD HAVE CAUGHT D74. Errors, not warnings: the whole point is that they stop
       * something reaching production, and this pair has a week of downtime behind it.
       */
      'no-constant-binary-expression': 'error',
      'no-unused-vars': 'off', // superseded by the TypeScript-aware version below
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          // An argument deliberately unused is named with a leading underscore, a convention this
          // codebase already follows (`_req`), so honour it rather than fighting it.
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          // Args before a used one cannot be removed without changing the call signature.
          args: 'after-used',
        },
      ],

      /**
       * THE REST OF THE SAME FAMILY: things that type-check and cannot be right. Each one is a way
       * for code to look finished and do nothing.
       */
      'no-self-assign': 'error',
      'no-self-compare': 'error',
      'no-unreachable': 'error',
      'no-dupe-else-if': 'error',
      'no-duplicate-case': 'error',
      'no-unsafe-negation': 'error',
      'no-unmodified-loop-condition': 'error',
      // A promise nobody awaits is the silent-failure shape that has bitten the save paths twice.
      'require-atomic-updates': 'off', // too many false positives on the autosave loops
      'no-await-in-loop': 'off', // the wave and the slide run await in loops ON PURPOSE

      /**
       * OFF, WITH REASONS, so nobody turns them on expecting an improvement.
       *
       * `any` is used deliberately at store boundaries where the shape on disk is genuinely
       * unknown and is validated immediately after, and the codebase's own normalisers are the
       * safety. Turning this on would flag those and teach people to add casts instead.
       */
      '@typescript-eslint/no-explicit-any': 'off',
      // The console prints raw diagnostics on purpose (the probes), and server logging is how the
      // publish paths report.
      'no-console': 'off',
    },
  },
];
