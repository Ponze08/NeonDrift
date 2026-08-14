# Neon Drift: Skyline Rush

Neon Drift: Skyline Rush is an original, browser-based 3D endless runner set above a colourful futuristic city. The runner accelerates automatically through three traffic lanes while the player changes lanes, jumps, slides, collects Prism coins, activates temporary abilities, and tries to keep a score multiplier alive.

The project uses procedural geometry and original interface artwork. It does not require a backend, downloaded game assets, or a native game engine.

## Highlights

- Responsive Three.js scene with a smooth third-person follow camera
- Three-lane movement, jumping, sliding, collisions, and increasing speed
- Recycled track segments and pooled coins, obstacles, vehicles, decorations, and power-ups
- Deterministic generation when a seed is supplied
- Five power-ups: Flux Magnet, Pulse Shield, Prism Booster, Sky Boots, and Nova Dash
- Persistent progression, missions, characters, cosmetics, high scores, currency, and statistics
- Desktop keyboard and mobile swipe input
- Original neon UI with loading, menu, HUD, countdown, pause, and result states
- Configurable audio, graphics, effects, shadows, camera shake, and swipe sensitivity
- Installable PWA shell with offline loading after the first successful visit
- Unit-tested non-rendering game logic

## Technology

- TypeScript in strict mode
- Vite
- Three.js
- HTML and CSS overlays (no UI framework)
- Web Audio API
- Vitest with jsdom
- ESLint and Prettier

## Requirements

- Node.js 20.19+ or 22.12+
- npm 10+
- A current browser with WebGL and ES2022 support

## Installation

```bash
git clone <repository-url>
cd neon-drift-skyline-rush
npm install
npm run dev
```

Vite prints the local URL, normally `http://localhost:5173`. Audio becomes active after the first user interaction because browsers block unattended audio playback.

## Commands

| Command                | Purpose                                                    |
| ---------------------- | ---------------------------------------------------------- |
| `npm run dev`          | Start the Vite development server with hot reload          |
| `npm run build`        | Type-check and create an optimized static build in `dist/` |
| `npm run preview`      | Serve the production build locally                         |
| `npm run test`         | Run the Vitest suite once                                  |
| `npm run lint`         | Run ESLint with zero warnings allowed                      |
| `npm run typecheck`    | Run TypeScript project checks without emitting files       |
| `npm run format`       | Format the project with Prettier                           |
| `npm run format:check` | Check formatting without changing files                    |

Before publishing, run:

```bash
npm run typecheck
npm run test
npm run lint
npm run build
```

## Controls

### Desktop

| Action                | Keys                       |
| --------------------- | -------------------------- |
| Move left             | `A` or `ArrowLeft`         |
| Move right            | `D` or `ArrowRight`        |
| Jump                  | `W`, `ArrowUp`, or `Space` |
| Slide                 | `S` or `ArrowDown`         |
| Activate a Fluxboard  | `B`                        |
| Pause or resume       | `Escape`                   |
| Restart after a crash | `R`                        |

### Touch

| Action               | Gesture                  |
| -------------------- | ------------------------ |
| Move left or right   | Swipe left or right      |
| Jump                 | Swipe up                 |
| Slide                | Swipe down               |
| Pause                | Tap the pause button     |
| Activate a Fluxboard | Tap the Fluxboard button |

The active game surface disables scrolling, pull-to-refresh, text selection, context menus, and browser zoom gestures. Swipe distance is configurable under Settings.

## Game flow

The game has six explicit states:

```text
Loading → Main menu → Countdown → Running
                                  ↕
                                Paused
                                  ↓
                               Game over
```

Only the systems relevant to the current state update. The animation loop caps unusually large frame deltas and pauses simulation when the page is hidden, which prevents a background tab from causing a large physics or scoring jump.

## Architecture

The runtime is deliberately modular. Game systems communicate through typed data and events; HTML UI code never imports the Three.js `Game` class.

```text
src/
  camera/       follow camera, field-of-view response, and impact shake
  core/         game state, loop, event bus, configuration, and orchestration
  data/         characters, power-ups, missions, difficulty, and track patterns
  entities/     pooled coins, obstacles, vehicles, power-ups, and decorations
  input/        keyboard and touch gesture adapters
  player/       runner mesh, controller, animation, and collision state
  systems/      scoring, saving, missions, progression, economy, and pools
  ui/           DOM views and the typed UIManager facade
  world/        segments, procedural selection, recycling, and scene population
  styles/       responsive visual design
  tests/        non-rendering Vitest coverage
public/
  icons/        original scalable Neon Drift icons
  manifest.webmanifest
  sw.js
```

### Important responsibilities

- `Game` owns high-level state transitions and composes all runtime services.
- `GameLoop` supplies capped delta time through `requestAnimationFrame`.
- `PlayerController` owns legal lane changes, grounded jumps, and timed slides.
- `TrackManager` keeps a fixed window of reusable segments around the player.
- `SegmentGenerator` chooses a valid layout for the current difficulty.
- `ObjectPool` and the specialized entity pools reset inactive objects instead of continually allocating replacements.
- `SaveManager` validates, migrates, repairs, and serializes plain data only.
- `UIManager` translates typed state snapshots into accessible HTML overlays and translates button presses into typed callbacks.

## Procedural generation

Track layouts are data objects in `src/data/patterns.ts`. Each pattern has a length, weight, minimum difficulty, complexity, and a list of entities positioned by lane and longitudinal row.

Before a layout is eligible, `validateObstaclePattern` performs a small reachability search. It advances all reachable lane/action states row by row, checks lane-change distance and action recovery time, and rejects a pattern if every route becomes blocked. `selectObstaclePattern` then filters by difficulty and performs weighted selection. Passing a number or string seed creates a repeatable pseudo-random sequence, which is useful for tests and reproducible runs.

The world keeps several segments ahead of the runner and a small buffer behind. Segments that fall behind are reset, moved forward, and repopulated from pools. Fog hides this recycling boundary.

## Adding an obstacle

1. Add the entity shape or behavior under `src/entities/`. Reuse shared geometry and material instances where practical.
2. Give the object a deterministic `reset`/activation path so it is safe to reuse through an entity pool.
3. Add its gameplay kind to `PatternEntityKind` in `src/data/patterns.ts` if the existing `jump-barrier`, `overhead-gate`, `lane-blocker`, or `vehicle` kinds do not fit.
4. Teach `TrackSegment` or `SegmentGenerator` how that kind is acquired, positioned, and released.
5. Update `requiredAction` and pattern validation if the obstacle changes route reachability.
6. Add a focused test for its collision and for at least one valid and invalid pattern containing it.

Keep collisions simple: lane checks plus reused bounding boxes or spheres are preferred over a full physics engine.

## Adding a track pattern

Add an `ObstaclePattern` to `OBSTACLE_PATTERNS` in `src/data/patterns.ts`:

```ts
{
  id: 'split-signal',
  name: 'Split Signal',
  length: 12,
  complexity: 2,
  minimumDifficulty: 0.2,
  weight: 1,
  entities: [
    { kind: 'lane-blocker', lane: -1, row: 5 },
    { kind: 'jump-barrier', lane: 0, row: 5 },
    { kind: 'coin', lane: 1, row: 5 },
  ],
}
```

Rows are zero-based and lanes are `-1`, `0`, and `1`. Keep reaction gaps fair, give the layout a route from every reasonable entry lane, and run the pattern-validation tests. Lower weights make distinctive or difficult patterns less common.

## Adding a character

1. Add a `CharacterDefinition` to `CHARACTER_DEFINITIONS` in `src/data/characters.ts`.
2. Use a unique stable ID. Saved ownership and equipped state reference this ID.
3. Define primary, secondary, accent, and skin colours plus one of the supported procedural silhouettes.
4. Set the coin price and whether the character is unlocked in a new save.
5. If introducing a new silhouette, add its mesh proportions to the procedural player builder and keep the collision dimensions gameplay-equivalent.
6. Map the definition to a `CharacterViewModel` when refreshing `UIManager.updateMenuData`.

Characters and cosmetics are visual choices; they do not provide paid gameplay advantages.

## Adding a power-up

1. Extend `PowerUpType` and `POWER_UP_DEFINITIONS` in `src/data/powerUps.ts`.
2. Add duration and tuning values to `GAME_CONFIG` in `src/core/Config.ts` where appropriate.
3. Add activation, update, expiry, and collision behavior to the owning gameplay system.
4. Ensure the pooled pickup resets all timers and visual state when released.
5. Send a `PowerUpIndicator` snapshot to `UIManager.updatePowerUps` while active.
6. Add pickup and expiry sound hooks, a lightweight player effect, and tests for duration and stacking behavior.

One-hit effects such as Pulse Shield may use a sentinel or separate active-state rule rather than a countdown bar.

## UI integration

`UIManager` is a game-independent facade. Construct it after the document is ready and subscribe to the actions the game owns:

```ts
import { UIManager } from './ui';

const ui = new UIManager();

ui.on('enter', () => {
  // Unlock audio and reveal the main menu.
  ui.showMainMenu(menuSnapshot);
});
ui.on('start', () => game.startRun());
ui.on('pause', () => game.pause());
ui.on('resume', () => game.resume());
ui.on('restart', () => game.restart());
ui.on('mainMenu', () => game.returnToMenu());
ui.on('activateHover', () => game.activateHoverDevice());
ui.on('settingsChange', (settings) => game.applySettings(settings));

ui.setLoadingProgress(0.7, 'Building traffic lanes…');
ui.setLoadingReady();
ui.showCountdown(3);
ui.showHUD({ score: 0, coins: 0, distance: 0, multiplier: 1, speed: 43 });
```

Primary update methods are:

- `showLoading`, `setLoadingProgress`, and `setLoadingReady`
- `showMainMenu`, `openMenuTab`, and `updateMenuData`
- `showCountdown` and `setCountdown`
- `showHUD`/`showRunning` and `updateHUD`
- `updatePowerUps`, `showMissionProgress`, `setHoverDeviceInventory`, and `setHoverDeviceActive`
- `showPause`/`showPauseMenu` and `showGameOver`
- `setSettings` and `getSettings`
- `showToast`, `showScorePopup`, `showLevelUp`, and `announce`
- `destroy` for listener and timer cleanup

Settings opened from the pause overlay include an explicit return to the still-paused run.

## Saving and migration

The save system stores a versioned plain-data document in `localStorage`. It includes high score, total coins, level, experience, active missions, owned and equipped cosmetics, Fluxboard inventory, settings, and lifetime statistics. Three.js objects, DOM elements, functions, and live run state are never serialized.

On load, `SaveManager`:

1. Parses the stored JSON defensively.
2. Checks the schema/version and migrates older fields.
3. Validates each supported value and supplies defaults for missing data.
4. Falls back to a clean default save if parsing or recovery fails.

Reset Save Data requires confirmation because it removes all local progression. Browser privacy modes, site-data clearing, or changing deployment origins can also remove or isolate a save.

## Mobile and performance notes

- Renderer pixel ratio is capped instead of blindly using the device pixel ratio.
- Low, medium, and high quality modes alter scene detail and expensive effects.
- Shadows and particles can be disabled independently.
- Repeated entities use shared geometry/materials and object pools.
- Collision scratch objects are reused inside the frame loop.
- Track recycling avoids frequent scene graph construction and garbage collection.
- Fog limits useful view distance and conceals segment turnover.
- The renderer and camera respond to resize and orientation changes.
- CSS uses `env(safe-area-inset-*)` for notches, rounded screens, and home indicators.
- Touch controls use pointer-safe hit targets and `touch-action` suppression on the play surface.
- `prefers-reduced-motion` removes nonessential UI animation.

For a mid-range phone, begin with medium quality and shadows disabled. Test portrait and landscape because browser chrome and safe areas vary substantially across devices.

## PWA and offline behavior

The production build registers `public/sw.js`. The service worker caches the application shell during installation and runtime-caches same-origin scripts, styles, images, fonts, and audio. Navigation uses the network when possible and falls back to the cached shell when offline.

Service workers require HTTPS, except on `localhost`. Development mode intentionally does not register one, which prevents stale cached bundles from interfering with hot reload. The original placeholder icons are SVG; some older install surfaces may prefer generated PNG variants for their launcher-specific requirements.

## Deployment

Run `npm run build` and publish the contents of `dist/` as static files. No server routes or environment secrets are required.

### Netlify, Vercel, or Cloudflare Pages

- Build command: `npm run build`
- Output directory: `dist`
- Framework preset: Vite, if offered

### GitHub Pages and custom subpaths

The Vite base defaults to a relative production path. To build with an explicit repository path, set `VITE_BASE_PATH`:

```bash
VITE_BASE_PATH=/repository-name/ npm run build
```

On PowerShell:

```powershell
$env:VITE_BASE_PATH = '/repository-name/'
npm run build
```

Keep the leading and trailing slash for an absolute hosted subpath. Manifest, icon, source entry, and service-worker registration URLs respect the Vite base.

## Known limitations

- Progress is local to one browser profile and does not sync between devices.
- The service worker provides a basic shell/runtime cache rather than background content downloads or update prompts.
- Procedural characters and props intentionally use low-poly primitives instead of skeletal model files.
- Mobile browser WebGL, memory limits, fullscreen behavior, and PWA icon handling differ by vendor.
- There is no online leaderboard, account system, multiplayer, or server-authoritative anti-cheat.
- Sound is synthesized and intentionally lightweight rather than a recorded music production.

## Future improvements

- Optional cloud save and cross-device progression
- Daily seeded skyline challenges and shareable run codes
- More district themes, weather states, and obstacle families
- Accessibility presets for colour vision and one-handed input
- PNG launcher icon generation for every platform-specific size
- Richer service-worker update UI and precache manifest generation
- Replay ghosts, local achievements, and performance telemetry overlay

## Originality

Neon Drift: Skyline Rush, its name, interface, characters, setting, procedural models, iconography, and visual language were created for this project. The game draws only on the broad endless-runner genre and does not use proprietary characters, maps, logos, music, textures, or UI from another game.
