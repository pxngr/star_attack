# ★ Star Attack ★

A classic-style space shooter built with Python + Pygame.

## Controls
| Input | Action |
|-------|--------|
| `Mouse` | Steer the ship left / right |
| `WASD` / `Arrow Keys` | Move (pressing `A`/`D` or left/right takes over from the mouse) |
| `SPACE` / `Left Click` | Shoot — click once or hold to keep firing (extra center shot when multiplier is active) |
| `M` | Music on / off |
| `R` / `SPACE` | Restart after game over |

## Features
- **3 enemy types**: Basic (purple), Fast (red), Tank (green, 3 HP)
- **Boss waves** every 10th wave — big hexagonal boss with rotating ring armor
- **Power-ups** drop randomly from destroyed enemies:
  - ❤️ Pink — Extra life
  - 💰 Gold — Score multiplier (up to x5)
  - ⚡ Cyan — Speed boost
- **Particle explosions** on hits and destructions
- **Starfield parallax background**
- **Retro chiptune audio** — 8 sound effects and a looping 4-bar background tune, all synthesized at startup (no asset files); degrades to silent when no audio device is available
- **Animated starship** — golden hull with wings, cyan cockpit, flickering engine flame and soft glow
- **Health feedback** — your lives are shown as star icons in the HUD (they turn red with a blinking `LAST SHIP!` warning on your final life), the screen flashes red when you're hit, and a glowing shield bubble appears around the ship right after respawn
- **Game over** — the game ends when all your ships are lost: you start with 3, pink power-ups add one (max 9), and each hit from an enemy, the boss, or an enemy bullet costs one ship (brief invincibility after each hit)

## Requirements
```bash
pip install pygame
```

## Run
```bash
cd ~/star_attack
python3 game.py
```
