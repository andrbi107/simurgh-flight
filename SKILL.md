---
name: simorgh
description: A Persian-themed PWA vertical flying/dodging canvas game where the Simurgh flies through the seven valleys of Attar's Conference of the Birds to Mount Qaf.
---

# سیمرغ: پرواز به قاف (Simurgh: Flight to Qaf)

## What this skill gives the model

After reading this skill, the model understands:

- the genre and core loop of Simurgh: Flight to Qaf (vertical flying/dodging on an HTML5 canvas, Persian RTL UI)
- the exact mechanics (player avatar, obstacles, collectibles, scoring, lives, valley progression, win/lose)
- the controls (touch + keyboard + mouse)
- the PWA structure required (manifest, service worker, icon)
- the file layout and how to deploy on GitHub Pages with no build step

## Game design

سیمرغ: پرواز به قاف is a 2D vertical flying and dodging game built with vanilla JS on an HTML5 `<canvas>`, with a Persian RTL interface. It re-imagines the myth of the Conference of the Birds (منطق‌الطیر) as an arcade flight: the player is the Simurgh, the mythical Persian bird, flying upward through the seven valleys (طلب، عشق، معرفت، استغنا، توحید، حیرت، فقر و فنا) toward Mount Qaf (کوه قاف).

The visual identity is a Persian miniature painting: a warm parchment background (#F3E7CF) with a faint double gold border frame and corner ornaments, parallax dune bands and drifting gold motes that scroll downward to convey upward flight, and Mount Qaf drawn as a lapis peaked triangle with a snow cap and a radial gold glow at the top of the screen. All art is drawn with canvas primitives — no images, no fonts, no external assets.

The Simurgh itself is drawn entirely from primitives: a gold elliptical body with a lapis outline, a small head with a vermilion beak and a three-line crest, two spread turquoise wings (filled quadratic-curve shapes with gold coverts and lapis feather-finger arcs) that flap with a sine wave, and a peacock-like tail fan of seven eye-spots (concentric turquoise/gold/ink circles) trailing below. Obstacles are likewise primitive: storm clouds are clusters of dark overlapping circles with faint highlights; hunters' arrows are vermilion shaft lines with triangle heads and gold fletching; worldly-attachment gems are rotated squares (gold or turquoise) with a white highlight.

The core loop is: the world auto-scrolls downward while the Simurgh stays in the lower third of the screen; the player dodges clouds and arrows, optionally grabs gems (which score but cost valley progress and briefly push the Simurgh sideways), and collects golden feathers (which restore a life or, at the cap, grant score, and every fifth feather summons a small companion bird that trails the Simurgh). A rarer small-bird pickup grants +50 and a timed 10-second companion that also trails and yields +1/s. Filling a valley's distance advances to the next valley (faster scroll, denser obstacles). Clearing all seven valleys triggers the victory screen with the Simurgh perched on Mount Qaf, then offers an endless harder mode.

## Mechanics in detail

- **Player band.** The Simurgh is constrained to a vertical band from `CFG.bandTop` (0.44·H) to `CFG.bandBottom` (0.86·H) and horizontally to `[playerR+12, W-playerR-24]`. Movement eases velocity toward a target with acceleration `CFG`-scaled; a gem distraction adds a lateral push for `driftMs`.
- **Auto-scroll.** The world scrolls at `scrollSpeed = baseScroll * (1+scrollPerValley)^valleyIndex`. Entities carry their own `vy` (clouds = scrollSpeed, arrows = scrollSpeed + 90..160, pickups slightly slower). Distance accumulates as `distValley += scrollSpeed*dt`; when it reaches `valleyLength()` the valley advances.
- **Spawning.** A `spawnTimer` decrements; when it hits zero an entity is spawned at `y=-40` with a random x, type chosen by weighted random (clouds always common, arrows scale up with valley index, gems moderate, feathers and companion-bird rare). Interval = `baseSpawn * spawnPerValley^valleyIndex`, floored at `minSpawn`, with jitter.
- **Collision.** Circle–circle with `rr = e.r + playerR`. Clouds/arrow hits are ignored while `invuln > 0`. Clouds pass through (not consumed); arrows are consumed on hit; pickups are always consumed.
- **Lives.** Start 3, max 5. A cloud/arrow hit: −1 life, `invuln = invulnMs` (blink by skipping render on alternating `blinkMs` windows), screen shake, hit sound, optional `navigator.vibrate`. At 0 lives the Simurgh enters a fall animation (rotates and accelerates downward) then shows the game-over screen.
- **Pickups.** Feather: `feathersCollected++`; if `lives < maxLives` then `lives++` else `score += featherScoreMax`; every `feathersPerCompanion` feathers summons a permanent cosmetic companion (capped at `maxCompanions`). Gem: `score += gemScore`, `distValley -= valleyLength * gemPenalty` (not below 0), `drift = driftMs` with random direction. Companion-bird: `score += companionScore`, adds a timed companion (`ttl = companionTtl` ms).
- **Companions.** Trail the Simurgh in a V formation; each yields `+1/s` added continuously to `score`. Timed ones fade out when their ttl expires. Permanent ones (from feather milestones) stay until game over.
- **Score.** `score += scrollSpeed*dt*scoreRate` (distance) + `companions.length*dt` (per-second bonus) + pickup bonuses. Displayed in Persian numerals; best persisted to `localStorage` key `simurgh.best`.
- **Valleys.** Seven, in order: طلب، عشق، معرفت، استغنا، توحید، حیرت، فقر و فنا. Each has an accent color used in the progress bar and the valley-name HUD chip. Completing valley index 6 (the 7th) triggers victory; after victory, "پرواز بی‌پایان" endless mode continues with `valleyIndex` increasing and difficulty scaling indefinitely.
- **Progress bar.** Drawn on the canvas at the right edge as 7 vertical segments (valley 0 at the bottom, valley 6 at the top). Completed valleys full; current valley partially filled from the segment's bottom upward; future valleys empty outlines. A small gold Qaf triangle marks the top.

## Controls

- **Touch:** drag anywhere on the canvas to move the Simurgh toward the pointer (horizontal + vertical within the band).
- **Keyboard:** Arrow keys or A/D for horizontal, W/S or Up/Down for vertical; P or Escape toggles pause; Space starts/retries from start/game-over/victory screens.
- **Mouse:** move the mouse over the canvas to steer the Simurgh (no press needed); pause button and screen buttons are clickable.

All three input methods feed the same eased-velocity movement so the game plays identically on phone, tablet, and desktop.

## File layout

- `index.html` — entry point, `lang="fa" dir="rtl"`, links `styles.css` + `main.js`, registers `sw.js`, holds the HUD and overlay screens.
- `styles.css` — responsive layout, parchment/gold/lapis theme, `clamp()`-based sizing, safe-area insets, `touch-action:none`, `100dvh`.
- `main.js` — the whole game: config, state, input, spawn, update, render (background, parallax, Mount Qaf, progress bar, entities, Simurgh, companions, particles, border frame), HUD, screens, WebAudio beeps, loop.
- `manifest.json` — PWA manifest, `start_url:"./"`, `scope:"./"`, `display:"fullscreen"`, `orientation:"portrait"`, one SVG icon.
- `sw.js` — service worker precaching the shell (`./`, `index.html`, `styles.css`, `main.js`, `manifest.json`, `icon.svg`) and serving offline.
- `icon.svg` — a stylized Simurgh silhouette (gold body + spread wings + peacock tail eyes + vermilion beak/crest) on a parchment rounded square.

## How to run / deploy

1. Open `index.html` directly in a browser, OR
2. Push the `simorgh/` folder to a GitHub repo and enable Pages — the game runs from the repo root or any subfolder because all paths are relative.

## PWA install

The manifest + service worker make the game installable on Android/iOS/desktop. After the first load the shell is cached and the game runs 100% offline.

## Customization hooks

All tunable parameters live in the `CFG` object at the top of `main.js`:

- `baseScroll`, `scrollPerValley` — world speed and its per-valley growth.
- `baseSpawn`, `spawnPerValley`, `minSpawn`, `spawnJitter` — spawn cadence and density.
- `valleyLen`, `valleyLenPerValley` — distance to clear each valley.
- `bandTop`, `bandBottom` — the vertical band the Simurgh can occupy.
- `maxLives`, `startLives`, `invulnMs`, `driftMs`, `blinkMs` — lives and hit/distraction timing.
- `gemPenalty`, `gemScore`, `featherScoreMax`, `companionScore`, `companionTtl`, `feathersPerCompanion`, `maxCompanions` — pickup effects.
- `scoreRate` — distance-to-score multiplier.
- `shakeMs`, `shakeMag`, `fallMs` — screen shake and fall-animation timing.

The `VALLEYS` array (also in `main.js`) defines the seven valley names and accent colors; `ENDLESS_NAME` is the label shown after victory. The `COL` object holds the palette.
