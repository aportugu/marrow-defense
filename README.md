# Marrow Defense

A polished browser MVP: defend your patient's bone marrow against 10 waves of multiple
myeloma clones using CAR-T cell units — while managing the same trade-offs real CAR-T
therapy has: **cytokine release syndrome (CRS), neurotoxicity, marrow burden,
cellular fitness, IEC-HS and delayed hematotoxicity (ICAHT)**. The medical systems are intentionally simplified
gameplay abstractions, not a clinical treatment simulator.

The campaign communicates target expression, antigen escape, inflammatory toxicity,
cellular persistence, and a wave-9 IEC-HS situation directly through enemy behavior,
combat feedback, meters, and audiovisual changes. A compact cited Clinical Glossary is
available from the menu and pause screen without interrupting play.

TypeScript + Vite + Canvas. No backend, no auth, no external assets.

## Play online

[Play Marrow Defense](https://aportugu.github.io/marrow-defense/)

The site is deployed automatically to GitHub Pages whenever a commit is pushed to
the `main` branch. The deployment workflow runs linting and tests, builds the static
Vite bundle, and publishes `dist/`.

## Run

```bash
npm install
npm run dev       # local dev server
npm run build     # production bundle
npm run preview   # serve the production build
npm run lint
npm run typecheck
npm run test      # vitest, run once
```

## Deploy

The repository includes `.github/workflows/deploy-pages.yml`. After creating the
GitHub repository, open **Settings → Pages** and choose **GitHub Actions** as the
source. Push to `main`, then follow the deployment in the repository's **Actions**
tab. The published URL is `https://aportugu.github.io/marrow-defense/`.

### Run as a desktop app (double-click)

The game is wrapped in Electron. Build it once, then open the `.app`:

```bash
npm run app       # builds Vite bundle + packages a macOS .app into release/
```

Then double-click `release/mac-arm64/Marrow Defense.app` (Finder), or:

```bash
open "release/mac-arm64/Marrow Defense.app"
```

- Rebuild any time the game changes with `npm run app` (the window loads the fresh `dist/` bundle).
- For fast iteration without repackaging: `npm run app:dev` (Electron window, `Ctrl/Cmd+R` to reload after `npm run build`).
- The packaged app is unsigned (local use); signing/notarization would be needed to distribute it to other Macs.

## How to play

- **Goal:** survive 10 waves. Leaked cells raise **burden**, add delayed
  **hematotoxicity**, and drain **fitness**. CRS, neurotoxicity, or IEC-HS reaching 100—or
  fitness reaching 0—ends the run. Hematotoxicity impairs recovery and can drain fitness,
  but does not directly end the run at 100.
- **Building:** select a unit and place it anywhere clear of the marrow stream and other
  units. Click a built unit to purchase either of its two upgrades.
- **Units:**
  - `BCMA CAR-T` — high single-target damage, most CRS, weak vs BCMA-low clones.
  - `Dual-Target CAR-T` — hits standard and BCMA-low targets, steadier, less CRS.
  - `Memory T Cell` — low damage, buffs nearby CAR-T cells, grows a little each wave.
- **Abilities (bottom bar):**
  - `TOCI` (Tocilizumab) — drops CRS by 40. 55 funding, 28s cooldown.
  - `DEXA` (Dexamethasone) — cuts neurotoxicity and suppresses new CRS for 8s, but
    slows CAR-T attacks and costs fitness.
  - `STEM` (Stem-Cell Boost) — once per run at hematotoxicity 20+, creates 15 seconds
    of gradual hematopoietic recovery and protects against hematotoxicity-driven fitness drain.
  - `ANAKINRA` — unlocks during the IEC-HS scenario. It temporarily suppresses new
    hyperinflammation and accelerates recovery; this is a gameplay abstraction, not
    dosing or treatment guidance.
  - `G-CSF` — repeatable at hematotoxicity 30+, provides 6 seconds of brief recovery and
    partial protection from hematotoxicity-driven fitness drain. It costs 45 funding and has
    a 24-second cooldown. These values are gameplay abstractions, not dosing guidance.
- **Tuning:** `src/game/Balance.ts` — every number lives there.

## Controls

- `Q` `W` `E` — select units; `1` `2` `3` `4` `5` — activate abilities;
  `Space`/`Enter` — start wave; `P` — pause; `Esc` — cancel selection.

## Testing

Colocated vitest suites cover the pure systems (no DOM needed):
Tests cover the pure systems, full-run balance scenarios, kinetic background data, and
DOM interactions.
