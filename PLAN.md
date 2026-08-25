# Marrow Defense — Plan

## Concept
Tower defense on a bone-marrow battlefield. The player is the CAR-T team: deploy and
upgrade cell units to intercept myeloma clones along a path, while five body meters
(burden, CRS, neurotoxicity, fitness, and hematotoxicity) model simplified treatment
trade-offs. Win by clearing 10 waves; lose when CRS, neurotoxicity, or IEC-HS reaches
100 or when fitness reaches 0. Hematotoxicity creates delayed, indirect fitness pressure;
repeatable G-CSF support provides a short recovery window while Stem-Cell Boost remains the
stronger once-per-run intervention. All timings and effects are gameplay abstractions.

## Architecture
- Pure, deterministic simulation (`src/systems/*`) operating on a single `GameState`
  (`src/game/types.ts`), seeded RNG for repeatability. All tuning in `src/game/Balance.ts`.
- `Game` (`src/game/Game.ts`) orchestrates: rAF loop, input, sound, high score, then
  `Renderer` (canvas) + `UI` (DOM) read state each frame.
- Vite + TypeScript strict + Vitest + ESLint 9. LocalStorage for settings/high score.

## Phase status
- [x] Scaffold: package.json, tsconfig, vite+vitest config, eslint, index.html
- [x] Core data: types, Balance, waves, path/spot generation, rng, storage
- [x] Systems: combat, waves, meters/economy, abilities, scoring (+ colocated tests)
- [x] Runtime: Game orchestrator, canvas Renderer, WebAudio Sound, consolidated DOM UI
  (HUD, menus, tutorial, popups), CSS theme
- [x] Polish pass: smoother balance, reactive living-marrow graphics,
  interaction feedback, reduced-motion support and deterministic scenario tests
- [ ] (v2) More enemies/units, campaign chapters, settings persistence UI, replays

## Structure
```
src/
  main.ts            bootstraps Game + UI into #app
  game/
    types.ts         shared types (GameState, Tower, Enemy, Meters, ...)
    Balance.ts       ALL tunable numbers
    GameState.ts     createInitialState / startGame / tutorial order
    Game.ts          orchestrator: loop, input, sound, high score
    Renderer.ts      canvas drawing (path, entities, combat FX)
    KineticBackground.ts deterministic ambient marrow layers and event reactions
  systems/
    CombatSystem.ts  range/damage/interval math, targeting, projectiles, leaks
    WaveSystem.ts    wave expansion, spawning, completion, win
    MeterSystem.ts   meters, passive economy, win/lose checks
    AbilitySystem.ts toci / dexa / stemcell rules
    ScoringSystem.ts composite score + grade
  data/waves.ts      10 handcrafted waves
  lib/               math, rng, path, storage (+ path.test.ts)
  ui/UI.ts           HUD, menus, tutorial, tooltips, popups, input wiring
  audio/              procedural WebAudio sound and adaptive music
  styles/main.css    theme
```

## Testing
Colocated `*.test.ts` for every pure system; `npm run test` (vitest run) +
`npm run typecheck` + `npm run lint` + `npm run build` are the delivery gates.
