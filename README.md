# Star Attack: YouTube Playables prototype

This is a separate, browser-native project alongside the original Pygame game. It starts a Canvas 2D port without changing `../game.py`.

## Run locally

Serve this folder over HTTP (ES modules do not run reliably from `file://`):

```sh
cd star-attack-playables
python3 -m http.server 4173
```

Then open <http://localhost:4173>. The prototype has a start screen, keyboard/mouse controls, touch-drag movement with continuous fire, dedicated hold-to-move/hold-to-fire buttons on touch screens (including hybrid touch laptops), wave pacing, boss fights, collectible power-ups, retro synthesized music and sound effects, score, lives, and restart.

## Try it on GitHub Pages

This folder is structured to be the root of a standalone GitHub repository. The workflow at `.github/workflows/pages.yml` deploys the site whenever code is pushed to `main` or `master` (or when manually triggered). Create a **public** repository, push the contents of this folder with `index.html` at the repository root, and enable GitHub Pages with **GitHub Actions** as the build/deploy source if prompted. After the Pages workflow succeeds, the public URL will be shown in the workflow deployment summary and under repository **Settings → Pages**.

GitHub Pages is public: do not upload private data, credentials, local saves, or development-only files. The standalone app stores its local leaderboard in each visitor's own browser.

### Controls and accessibility

- **Mouse:** move over the playfield to steer in both axes; click or hold to fire.
- **Keyboard:** arrows or W/A/S/D to move; Space to fire; M toggles music; Escape pauses/resumes. The speaker and pause icon buttons sit in a separate boxed control group in the top-left on desktop and touch screens. From level 3, hold Down + Space to launch a missile. Movement is clamped to the lower 55% of the playfield.
- **Touch:** drag anywhere on the playfield to move in both axes while firing, or tap/hold the four direction and fire buttons. Taps make a short movement or firing action; holds continue until release. You can hold fire while steering with another finger. Releasing or cancelling one touch does not cancel the other.
- Touch targets are at least 64 CSS pixels, are labelled for assistive technology, and stay clear of the player ship. Use the start and replay buttons with touch, mouse, or keyboard.
- **Power-ups:** a pink bubble appears on every even-numbered wave; shoot it for an extra life. Enemies also have a small chance to drop collectible life, score multiplier, or speed power-ups. Lives cap at nine, multiplier at x5, and speed at 9. The multiplier adds a third bullet at x2 and multiplies enemy/boss scores.
- **Levels and enemy unlocks:** defeat the boss every 10th wave to advance a level and earn a score bonus. Each level increases enemy count and movement/attack speed. Monsters join at level 2, shielded/armed aliens and missile access at level 3, and three-shot raider ships at level 4. The first wave after each unlock guarantees an example of that enemy. Standard shots cannot damage shielded aliens; missiles can.
- **Boss shield:** each boss fight releases one shootable cyan shield bubble. Shoot it to block collisions and enemy fire for 15 seconds at early boss levels, decreasing gradually to 10 seconds at high difficulty. The remaining duration is visible above the playfield, and the shield pickup disappears when its boss is defeated.
- **Enemy visuals:** enemy and boss sprites use layered hull gradients, specular highlights, rim accents, and soft contact shadows for a lightweight 2.5D look without downloading 3D assets.
- **Audio:** a four-bar chiptune loop and short synthesized arcade effects are generated with Web Audio; no audio assets are downloaded. Audio starts after the Play gesture. M toggles the music while leaving sound effects enabled.
- **Visual motion:** ship exhaust uses a small, short-lived particle field with additive-looking orange/white glow, and eases into a bank when steering. Star trails stretch with apparent speed; lateral and vertical movement also shifts the field subtly for a depth/parallax cue.
- **Pilot names and leaderboard:** standalone browser play asks for a 1–20 character callsign and stores a top-10 local leaderboard. In YouTube Playables, the name field is hidden and the game uses the generic callsign "Pilot"; profile saves contain anonymous scores/progress only, not a user-entered name. Playables checks `ytgame.IN_PLAYABLES_ENV`, loads/saves progress (`highScore`, `highestLevel`, `highestWave`, `updatedAt`, and top `scores`) via `ytgame.game.loadData()` / `ytgame.game.saveData()`, backs up progress on pause (`onPause`), and submits the saved best score with `ytgame.engagement.sendScore({ value })`. This is profile-scoped with no external third-party backend.
- **Pause and music:** press Escape or use the pause button in the boxed top-left utility controls; toggle music with the adjacent speaker icon button. The life/power-up notice is shown below the top HUD metrics. The pause screen includes resume and leaderboard actions. SDK pause/resume callbacks remain authoritative while hosted in Playables.

## Initial architecture

```text
index.html + styles.css
        │
        ▼
src/main.js ─────────────── app lifecycle / animation frame
   ├── src/game.js ──────── simulation state and rules (rendering-agnostic)
   ├── src/input.js ─────── keyboard, mouse, and touch → normalized controls
   ├── src/renderer.js ──── Canvas 2D rendering
   └── src/platform.js ──── YouTube Playables lifecycle bridge
```

The browser prototype intentionally has no framework, asset downloads, or build step. Its game rules are kept out of the renderer and platform adapter so the original game can be ported feature-by-feature and tested independently. `src/audio.js` synthesizes the music and effects with Web Audio.

## 2D effects versus 3D

For this portrait arcade game, keep the current Canvas 2D renderer for now: it delivers the particle trails, ship banking, and parallax at low download and GPU cost, which is a good fit for a Playable. For a real 3D redesign, use **Three.js** for WebGL rendering, create low-poly ships/aliens in Blender and export optimized **glTF/GLB**, and pair it with **Rapier 3D** only if you need collision response or rigid-body behavior. Use fixed-step physics with interpolated rendering; keep enemies' impact response intentionally arcade-like (bounded bounce/knockback) rather than physically simulating every particle. This adds bundle, asset, memory, and mobile-GPU costs, so profile it on low-end devices and run the Playables test suite before committing to the migration. Babylon.js is a reasonable all-in-one alternative if you prefer a more integrated engine, but neither 3D option is needed for the current 2D game.

## Proposed migration plan

1. **Establish the browser foundation (started).** Create a responsive Canvas app, separate simulation/input/rendering/platform concerns, and make a playable vertical slice. Keep the Pygame project intact as a reference.
2. **Recover and document Pygame behavior.** The current `game.py` references runtime classes/methods that are not defined in the checked-in file (`SoundBank`, `StarField`, `Boss`, `PowerUp`, `Particle`, `Player.reset`, and `draw_level_up`); `Bullet` also has no generated initializer. Resolve these gaps or treat the browser prototype as the executable source of truth before claiming parity.
3. **Port gameplay in slices.** Wave pacing, shootable life bubbles, every-10th-wave bosses, level progression, enemy unlocks, collectible power-ups, missiles, alien shields, two-axis movement, and synthesized audio are implemented. Continue verifying against an explicit behavior checklist.
4. **Complete Playables integration.** Readiness, SDK pause/resume, YouTube audio settings, user-scoped top-run cloud data, and score submission are implemented. The saved payload is versioned and loaded before any save or game-ready notification.
5. **Polish for mobile and certification.** Test every interaction via touch and mouse, resize without resetting state, check accessibility and performance, and run the official Playables test suite including CSP checks. Prepare store metadata/thumbnails separately from the game bundle.

## Deployment status

YouTube Playables developer access is currently early access. Public release requires review/certification, and release procedures are coordinated with a designated YouTube Partner Manager; this project cannot self-publish directly from the source folder.

1. Apply through the [YouTube Playables interest form](https://docs.google.com/forms/d/e/1FAIpQLSdvdQ0lgIq2369aemj1O6w8R8FwGn9O5ARRGODDDUbVINCRJQ/viewform) and wait for developer access/Partner Manager instructions.
2. Before submission, run the [official SDK test suite](https://developers.google.com/youtube/gaming/playables/reference/test_suite_guide) against an HTTP-hosted copy using the required Playables CSP. Verify mobile WebView/touch, resizing, audio, pause/resume, cloud saves, and score behavior.
3. Use the Developer Portal's instructions for the exact upload format and required metadata (title, description, genre, publisher/developer details, and thumbnails). Keep `index.html` at the bundle root with the YouTube SDK script before game code.
4. Submit for YouTube's technical, privacy, safety, and content review; launch timing/rollout is controlled by YouTube after certification.

The project has no compile step. The Portal requires a ZIP with `index.html` at its root and the referenced `styles.css` and `src/` files alongside it. Do not include README or development-only files in the upload bundle unless the Portal explicitly requests them.

## Current prototype boundaries

- Each run resets; standalone play persists its top-10 score list and last callsign in browser storage, while Playables persists anonymous top scores and progress in the YouTube profile. Audio requires browser Web Audio support and starts only after the user's Play gesture.
- The Playables SDK bridge is a guarded integration seam. Local browser play does not require the SDK; SDK readiness, pause/resume, and audio callbacks are enabled when its documented APIs are present in the Playables environment. The current run itself is not resumable; only the leaderboard and last pilot name persist.
- This is an engineering prototype, not a certified or published Playable. Developer access and review are required for release.
- YouTube's privacy requirements prohibit prompting for names or usernames. The Playables experience therefore uses an anonymous callsign, while local standalone play retains the name-entry feature.

## References

- [YouTube Playables overview](https://developers.google.com/youtube/gaming/playables)
- [Integration requirements](https://developers.google.com/youtube/gaming/playables/certification/requirements_integration)
- [Design requirements](https://developers.google.com/youtube/gaming/playables/certification/requirements_design)
- [Stability and performance requirements](https://developers.google.com/youtube/gaming/playables/certification/requirements_stability)
- [Playables SDK test suite guide](https://developers.google.com/youtube/gaming/playables/reference/test_suite_guide)
