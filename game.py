"""
★ STAR ATTACK ★
A classic-style space shooter in Python + Pygame.

Controls
--------
  Mouse             : steer the ship left / right
  WASD / Arrow Keys : move (pressing A/D or left/right takes over from the mouse)
  SPACE / Left Click: shoot - click once or hold to keep firing
  M                 : music on/off
  R / SPACE         : restart after game over

Sound
-----
Retro chiptune sound effects plus a looping 4-bar background tune, all
synthesized at startup - no asset files.  If no audio device is
available the game simply runs silent.

Goal
----
Survive endless waves of enemies, dodge boss shots, and collect power-ups:
  pink = extra life, gold = score multiplier, cyan = speed boost.

Requires:  pip install pygame
Run:       python3 game.py
"""

import array
import math
import random
import sys
from dataclasses import dataclass, field
from enum import Enum

try:
    import pygame
except ImportError:
    print("Pygame not found. Install it with:  pip install pygame")
    sys.exit(1)

# ─────────────────────────── Config ─────────────────────────────

SCREEN_W, SCREEN_H = 800, 600
FPS = 60

COLORS = {
    "bg":          (12, 12, 30),
    "star_ship":   (255, 180, 50),
    "star_core":   (255, 240, 150),
    "bullet":      (255, 140, 50),
    "e_bullet":    (255, 80, 60),
    "enemy_basic": (200, 60, 180),
    "enemy_fast":  (255, 60, 100),
    "enemy_tank":  (80, 255, 140),
    "boss":        (255, 80, 80),
    "pu_life":     (255, 80, 160),
    "pu_mult":     (255, 240, 100),
    "pu_speed":    (80, 255, 240),
    "white":       (255, 255, 255),
    "yellow":      (255, 240, 100),
    "green":       (80, 255, 140),
}

POWERUP_COLORS = {
    "life": COLORS["pu_life"],
    "mult": COLORS["pu_mult"],
    "speed": COLORS["pu_speed"],
}

ENEMY_COLORS = {
    "basic": COLORS["enemy_basic"],
    "fast": COLORS["enemy_fast"],
    "tank": COLORS["enemy_tank"],
    "monster": (255, 50, 50),
    "alien": (50, 255, 50),
}


def circle_col(a, b, r1, r2):
    """Circle-circle collision test."""
    dx = a[0] - b[0]
    dy = a[1] - b[1]
    rr = r1 + r2
    return dx * dx + dy * dy <= rr * rr


def star_vertices(cx, cy, outer_r, inner_r, points=5):
    """Vertices of a 5-point star, tip pointing up."""
    verts = []
    for i in range(points * 2):
        r = outer_r if i % 2 == 0 else inner_r
        a = math.pi / 2 + math.pi * i / points
        verts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return verts


def draw_star(surface, cx, cy, outer_r, inner_r=None,
              outer_color=COLORS["star_ship"], inner_color=COLORS["star_core"]):
    """Draw a two-tone star (ship hull)."""
    inner_r = inner_r if inner_r is not None else outer_r * 0.5
    pygame.draw.polygon(surface, outer_color,
                        star_vertices(cx, cy, outer_r, inner_r))
    pygame.draw.polygon(surface, inner_color,
                        star_vertices(cx, cy, outer_r * 0.6, inner_r * 0.6))


# Pre-rendered glow / shield sprites (cached to avoid per-frame allocation)
_GLOW_SURF = {}
_SHIELD_SURF = {}


def _glow(scale):
    key = int(scale * 10)
    surf = _GLOW_SURF.get(key)
    if surf is None:
        size = int(70 * scale)
        c = size // 2
        surf = pygame.Surface((size, size), pygame.SRCALPHA)
        pygame.draw.circle(surf, (255, 170, 60, 26), (c, c), c - 2)
        pygame.draw.circle(surf, (255, 200, 100, 30), (c, c), int(c * 0.62))
        _GLOW_SURF[key] = surf
    return surf


def _shield(radius):
    surf = _SHIELD_SURF.get(radius)
    if surf is None:
        size = radius * 2 + 6
        c = size // 2
        surf = pygame.Surface((size, size), pygame.SRCALPHA)
        pygame.draw.circle(surf, (110, 205, 255, 40), (c, c), radius)
        pygame.draw.circle(surf, (195, 238, 255, 175), (c, c), radius, 2)
        _SHIELD_SURF[radius] = surf
    return surf


def draw_ship(surface, cx, cy, scale=1.0):
    """Beautiful retro starship with an animated engine flame."""
    s = scale
    t = pygame.time.get_ticks() / 1000.0

    def pt(dx, dy):
        return (cx + dx * s, cy + dy * s)

    # soft glow behind the ship
    glow = _glow(s)
    surface.blit(glow, glow.get_rect(center=(cx, cy)))

    # flickering engine flame
    flick = 10 + 3.5 * math.sin(t * 22) + 1.8 * math.sin(t * 37)
    pygame.draw.polygon(surface, (255, 120, 40),
                        [pt(-6, 12), pt(6, 12), pt(0, 12 + flick)])
    pygame.draw.polygon(surface, (255, 235, 140),
                        [pt(-3, 12), pt(3, 12), pt(0, 12 + flick * 0.55)])

    # wings + red wingtips
    pygame.draw.polygon(surface, (210, 150, 45),
                        [pt(-5, -2), pt(-19, 9), pt(-15, 14), pt(-5, 10)])
    pygame.draw.polygon(surface, (210, 150, 45),
                        [pt(5, -2), pt(19, 9), pt(15, 14), pt(5, 10)])
    pygame.draw.polygon(surface, (255, 90, 70),
                        [pt(-19, 9), pt(-15, 14), pt(-13.5, 10.8)])
    pygame.draw.polygon(surface, (255, 90, 70),
                        [pt(19, 9), pt(15, 14), pt(13.5, 10.8)])

    # hull
    hull = [pt(0, -21), pt(5, -12), pt(7, 2), pt(6, 12),
            pt(-6, 12), pt(-7, 2), pt(-5, -12)]
    pygame.draw.polygon(surface, (255, 190, 60), hull)
    pygame.draw.polygon(surface, (70, 35, 10), hull, max(1, int(s)))

    # center stripe + bright nose cone
    pygame.draw.polygon(surface, (255, 240, 170),
                        [pt(0, -19), pt(2.5, -8), pt(2.5, 10),
                         pt(-2.5, 10), pt(-2.5, -8)])
    pygame.draw.polygon(surface, (255, 252, 220),
                        [pt(0, -21), pt(3, -13), pt(-3, -13)])

    # cockpit canopy
    pygame.draw.ellipse(surface, (90, 220, 255),
                        (cx - 3 * s, cy - 8 * s, 6 * s, 10 * s))
    pygame.draw.ellipse(surface, (230, 250, 255),
                        (cx - 1.5 * s, cy - 6.5 * s, 3 * s, 4 * s))


class Bullet:
    x: float
    y: float
    vx: float = 0.0
    vy: float = 0.0
    radius: int = 3
    is_missile: bool = False
    damage: float = 1.0


@dataclass
class Missile:
    x: float
    y: float
    vx: float = 0.0
    vy: float = -8.0
    radius: int = 12
    damage: float = 5.0


# ─────────────────────── Enemies ─────────────────────────────────
class EnemyType(Enum):
    BASIC = "basic"
    FAST = "fast"
    TANK = "tank"
    MONSTER = "monster"
    ALIEN = "alien"


@dataclass
class Enemy:
    x: float
    y: float
    vy: float = 1.5
    radius: int = 14
    type_: EnemyType = EnemyType.BASIC
    score_val: int = 100
    hp: int = 1
    phase: float = field(default_factory=lambda: random.uniform(0, math.pi * 2))
    shielded: bool = False

    def update(self):
        self.y += self.vy
        self.phase += 0.06
        if self.type_ is EnemyType.FAST:
            # fast enemies weave side to side
            self.x += math.sin(self.phase) * 2.0
            self.x = max(self.radius, min(SCREEN_W - self.radius, self.x))
        if self.type_ is EnemyType.ALIEN and self.shielded:
            # aliens hover slightly
            self.y += math.sin(self.phase * 0.5) * 0.5

    def hit(self, is_missile=False):
        """Return True if this shot killed the enemy."""
        if self.shielded and not is_missile:
            return False
        self.hp -= 1
        return self.hp <= 0

    def draw(self, surface):
        color = ENEMY_COLORS[self.type_.value]
        cx, cy = int(self.x), int(self.y)
        r = self.radius
        if self.type_ is EnemyType.TANK:
            verts = []
            for i in range(6):
                a = math.pi / 3 * i + self.phase
                verts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
            pygame.draw.polygon(surface, color, verts)
        elif self.type_ is EnemyType.FAST:
            pygame.draw.circle(surface, color, (cx, cy), r)
        else:
            draw_star(surface, cx, cy, r, r * 0.6, color, COLORS["star_core"])


@dataclass
class Player:
    x: float = SCREEN_W / 2
    y: float = SCREEN_H - 80
    speed: float = 5.5
    radius: int = 16
    lives: int = 3
    score: int = 0
    mult: int = 1
    invincible: float = 0.0
    level: int = 1
    arsenal: list[str] = field(default_factory=lambda: [])
    missile_cooldown: float = 0.0

    def update(self, keys, mouse_x=None):
        """Move the ship.
        """
        if mouse_x is not None:
            self.x = mouse_x
            self.mouse_active = True
        elif keys[pygame.K_LEFT] or keys[pygame.K_a]:
            self.x -= self.speed
            self.mouse_active = True
        elif keys[pygame.K_RIGHT] or keys[pygame.K_d]:
            self.x += self.speed
            self.mouse_active = True
        else:
            self.mouse_active = False

        self.y = max(self.radius, min(SCREEN_H - self.radius, self.y))
        self.x = max(self.radius, min(SCREEN_W - self.radius, self.x))
        
        if self.invincible > 0:
            self.invincible -= 1 / FPS
        
        if self.missile_cooldown > 0:
            self.missile_cooldown -= 1 / FPS

    def draw(self, surface):
        cx, cy = int(self.x), int(self.y)
        draw_ship(surface, cx, cy)
        if self.invincible > 0:
            # glowing shield bubble instead of the old blink
            r = int(self.radius + 8 + 2 * math.sin(pygame.time.get_ticks() / 125.0))
            bubble = _shield(r)
            surface.blit(bubble, bubble.get_rect(center=(cx, cy)))


class StarAttackGame:
    def __init__(self):
        pygame.mixer.pre_init(44100, -16, -1, 512)
        pygame.init()
        self.screen = pygame.display.set_mode((SCREEN_W, SCREEN_H))
        pygame.display.set_caption("★ STAR ATTACK ★")
        self.clock = pygame.time.Clock()
        self._damage_overlay = pygame.Surface((SCREEN_W, SCREEN_H), pygame.SRCALPHA)
        self._damage_overlay.fill((255, 45, 30, 255))
        self.damage_flash = 0
        self.font_large = pygame.font.SysFont("monospace", 36, bold=True)
        self.font_med = pygame.font.SysFont("monospace", 24, bold=True)
        self.font_small = pygame.font.SysFont("monospace", 18)
        self.sounds = SoundBank()
        self.starfield = StarField()
        self.mouse_x = SCREEN_W / 2
        self.mouse_active = False
        self._shoot_sfx_cd = 0
        self.current_level = 1
        self.next_level_score = 10000
        self.level_up_state = "none"   # "none" | "showing"
        self.level_up_data = {}
        self.missiles = []
        self.reset_game()
        self.game_state = "start"   # "start" | "playing" | "gameover" | "levelup"

    def reset_game(self):
        self.player = Player()
        self.bullets = []
        self.missiles = []
        self.e_bullets = []
        self.enemies = []
        self.bosses = []
        self.particles = []
        self.powerups = []
        self.wave_num = 0
        self.wave_timer = 0
        self.wave_msg = ""
        self.wave_msg_timer = 0
        self.current_level = 1
        self.next_level_score = 10000
        self.level_up_state = "none"
        self.level_up_data = {}
        self.game_state = "playing"

    def start_wave(self):
        """Build the next wave. Every 10th wave is a boss wave."""
        self.wave_num += 1
        if self.wave_num % 10 == 0:
            self.bosses.append(Boss())
            self.wave_msg = f"BOSS WAVE {self.wave_num // 10}!"
            self.sounds.play("boss_alarm")
        else:
            # Use level to determine enemy difficulty
            count = min(5 + self.wave_num * 2, 24)
            for _ in range(count):
                # Determine enemy type based on level
                if self.current_level == 1:
                    etype_list = [EnemyType.BASIC, EnemyType.FAST, EnemyType.TANK]
                    weights = [0.7, 0.2, 0.1]
                elif self.current_level == 2:
                    etype_list = [EnemyType.FAST, EnemyType.TANK, EnemyType.MONSTER]
                    weights = [0.6, 0.3, 0.1]
                else:
                    etype_list = [EnemyType.TANK, EnemyType.MONSTER, EnemyType.ALIEN]
                    weights = [0.5, 0.4, 0.1]

                etype = random.choices(etype_list, weights=weights)[0]
                x = random.randint(60, SCREEN_W - 60)
                
                # base stats
                base_hp = 1
                base_score = 100
                
                if etype == EnemyType.BASIC:
                    base_hp = 1; base_score = 100
                elif etype == EnemyType.FAST:
                    base_hp = 1; base_score = 200
                elif etype == EnemyType.TANK:
                    base_hp = 3; base_score = 300
                elif etype == EnemyType.MONSTER:
                    base_hp = 5; base_score = 500
                elif etype == EnemyType.ALIEN:
                    base_hp = 2; base_score = 1000 # aliens are tricky

                new_enemy = Enemy(
                    x, -30, 
                    vy=random.uniform(1.2 + (self.current_level * 0.2), 2.5 + (self.current_level * 0.2)), 
                    radius=14, type_=etype, score_val=base_score, hp=base_hp)
                if etype == EnemyType.ALIEN:
                    new_enemy.shielded = True
                self.enemies.append(new_enemy)
                
            self.wave_msg = f"WAVE {self.wave_num}"
            self.sounds.play("wave")
        self.wave_msg_timer = 120

    def spawn_player_bullets(self):
        keys = pygame.key.get_pressed()
        mouse_pressed = pygame.mouse.get_pressed()[0]
        
        if not (keys[pygame.K_SPACE] or mouse_pressed):
            return

        px, py = self.player.x, self.player.y - self.player.radius

        # Missile Attack Combo: DOWN + SPACE
        if keys[pygame.K_DOWN] and keys[pygame.K_SPACE] and "missiles" in self.player.arsenal and self.player.missile_cooldown <= 0:
            self.missiles.append(Missile(px, py))
            self.player.missile_cooldown = 3.0  # 3s cooldown
            self.sounds.play("missile_launch") # Assuming we add this or use an existing
            return

        self.bullets.append(Bullet(px - 10, py, 0, -11))
        self.bullets.append(Bullet(px + 10, py, 0, -11))
        if self.player.mult >= 2:
            self.bullets.append(Bullet(px, py - 4, 0, -12))
        if self._shoot_sfx_cd <= 0:
            self.sounds.play("shoot")
            self._shoot_sfx_cd = 6   # don't retrigger the blip every frame

    def spawn_enemy_bullets(self):
        for e in self.enemies:
            if random.random() < 0.004:  # occasional straight shot
                self.e_bullets.append(Bullet(e.x, e.y + e.radius, 0, 3.0))
        for bo in self.bosses:
            bo.shoot_timer += 1
            if bo.shoot_timer % 40 == 0:
                # aimed shot at the player
                dx = self.player.x - bo.x
                dy = self.player.y - bo.y
                d = math.hypot(dx, dy) or 1.0
                self.e_bullets.append(Bullet(
                    bo.x, bo.y + bo.radius * 0.7,
                    dx / d * 4.5, dy / d * 4.5))

    def drop_powerup(self, x, y, kind=None):
        kind = kind or random.choice(("life", "mult", "speed"))
        self.powerups.append(PowerUp(x, y, kind))

    def maybe_drop_powerup(self, x, y):
        if random.random() < 0.08:
            self.drop_powerup(x, y)

    def spawn_particles(self, x, y, color, count=10):
        for _ in range(count):
            angle = random.uniform(0, math.pi * 2)
            spd = random.uniform(1.5, 5.0)
            self.particles.append(Particle(
                x, y,
                math.cos(angle) * spd, math.sin(angle) * spd,
                random.randint(25, 60), color))

    # ── combat ──────────────────────────────────────────────────

    def take_damage(self):
        """Player was hit. Lose a life, respawn, or game over."""
        self.spawn_particles(self.player.x, self.player.y,
                             COLORS["star_ship"], 25)
        self.sounds.play("hit")
        self.damage_flash = 10
        self.player.lives -= 1
        if self.player.lives > 0:
            self.player.reset()
        else:
            self.game_state = "gameover"
            self.sounds.stop_music()
            self.sounds.play("gameover")

    def collect_powerup(self, pu):
        self.sounds.play("powerup")
        if pu.kind == "life":
            self.player.lives = min(self.player.lives + 1, 9)
        elif pu.kind == "mult":
            self.player.mult = min(self.player.mult + 1, 5)
        else:  # speed
            self.player.speed = min(self.player.speed + 1.0, 9.0)

    # ── per-frame update ────────────────────────────────────────

    def update(self):
        if self.game_state != "playing":
            return

        self.starfield.update()

        # start a new wave when the previous one is cleared
        if not self.enemies and not self.bosses:
            self.wave_timer += 1
            if self.wave_timer >= 60:
                self.wave_timer = 0
                self.start_wave()

        if self._shoot_sfx_cd > 0:
            self._shoot_sfx_cd -= 1

        # shooting
        self.spawn_player_bullets()

        # move + cull player bullets
        for b in self.bullets:
            b.x += b.vx
            b.y += b.vy
        self.bullets = [b for b in self.bullets
                        if -30 < b.y < SCREEN_H + 30 and -30 < b.x < SCREEN_W + 30]

        # move + cull missiles
        for m in self.missiles:
            m.x += m.vx
            m.y += m.vy
        self.missiles = [m for m in self.missiles
                         if -30 < m.y < SCREEN_H + 30 and -30 < m.x < SCREEN_W + 30]

        # move + cull enemy bullets
        for b in self.e_bullets:
            b.x += b.vx
            b.y += b.vy
        self.e_bullets = [b for b in self.e_bullets
                          if -30 < b.y < SCREEN_H + 30 and -30 < b.x < SCREEN_W + 30]

        # move enemies, drop ones that flew past the bottom
        for e in self.enemies:
            e.update()
        self.enemies = [e for e in self.enemies if e.y < SCREEN_H + 40]

        # move bosses
        for bo in self.bosses:
            bo.update()

        # enemies fire
        self.spawn_enemy_bullets()

        # particles
        for p in self.particles:
            p.x += p.vx
            p.y += p.vy
            p.life -= 1
        self.particles = [p for p in self.particles if p.life > 0]

        # power-ups drift down
        for pu in self.powerups:
            pu.y += pu.vy
        self.powerups = [pu for pu in self.powerups if pu.y < SCREEN_H + 20]

        # ── collisions: player bullets vs enemies / boss ──
        for b in self.bullets[:]:
            consumed = False
            for e in self.enemies:
                if circle_col((b.x, b.y), (e.x, e.y), b.radius, e.radius):
                    consumed = True
                    if e.hit(b.is_missile):
                        self.player.score += e.score_val * self.player.mult
                        self.spawn_particles(e.x, e.y,
                                             ENEMY_COLORS[e.type_.value], 12)
                        self.maybe_drop_powerup(e.x, e.y)
                        self.enemies.remove(e)
                        self.sounds.play("explosion")
                    else:
                        self.spawn_particles(b.x, b.y, COLORS["white"], 4)
                    break
            if consumed:
                self.bullets.remove(b)
                continue
            for bo in self.bosses:
                if circle_col((b.x, b.y), (bo.x, bo.y), b.radius, bo.radius):
                    consumed = True
                    if bo.hit(b.is_missile):
                        self.player.score += 500 * self.player.mult
                        self.spawn_particles(bo.x, bo.y, COLORS["boss"], 40)
                        self.drop_powerup(bo.x - 50, bo.y, "life")
                        self.drop_powerup(bo.x + 50, bo.y, "mult")
                        self.bosses.remove(bo)
                        self.sounds.play("explosion_big")
                    else:
                        self.spawn_particles(b.x, b.y, COLORS["yellow"], 4)
                    break
            if consumed:
                self.bullets.remove(b)

        # ── collisions: missiles vs enemies / boss ──
        for m in self.missiles[:]:
            consumed = False
            for e in self.enemies:
                if circle_col((m.x, m.y), (e.x, e.y), m.radius, e.radius):
                    consumed = True
                    if e.hit(True):
                        self.player.score += e.score_val * self.player.mult
                        self.spawn_particles(e.x, e.y,
                                             ENEMY_COLORS[e.type_.value], 12)
                        self.maybe_drop_powerup(e.x, e.y)
                        self.enemies.remove(e)
                        self.sounds.play("explosion")
                    else:
                        self.spawn_particles(m.x, m.y, COLORS["white"], 4)
                    break
            if consumed:
                self.missiles.remove(m)
                continue
            for bo in self.bosses:
                if circle_col((m.x, m.y), (bo.x, bo.y), m.radius, bo.radius):
                    consumed = True
                    if bo.hit(True):
                        self.player.score += 500 * self.player.mult
                        self.spawn_particles(bo.x, bo.y, COLORS["boss"], 40)
                        self.drop_powerup(bo.x - 50, bo.y, "life")
                        self.drop_powerup(bo.x + 50, bo.y, "mult")
                        self.bosses.remove(bo)
                        self.sounds.play("explosion_big")
                    else:
                        self.spawn_particles(m.x, m.y, COLORS["yellow"], 4)
                    break
            if consumed:
                self.missiles.remove(m)

        # ── collisions: player vs enemies / boss / enemy bullets ──
        if self.player.invincible <= 0:
            ppos = (self.player.x, self.player.y)
            hit = False
            for e in self.enemies[:]:
                if circle_col(ppos, (e.x, e.y),
                              self.player.radius, e.radius):
                    self.enemies.remove(e)
                    self.spawn_particles(e.x, e.y,
                                         ENEMY_COLORS[e.type_.value], 10)
                    hit = True
                    break
            if not hit:
                for bo in self.bosses:
                    if circle_col(ppos, (bo.x, bo.y),
                                  self.player.radius, bo.radius):
                        hit = True
                        break
            if not hit:
                for b in self.e_bullets[:]:
                    if circle_col(ppos, (b.x, b.y),
                                  self.player.radius, b.radius):
                        self.e_bullets.remove(b)
                        hit = True
                        break
            if hit:
                self.take_damage()

        # ── collisions: player vs power-ups ──
        for pu in self.powerups[:]:
            if circle_col((self.player.x, self.player.y),
                          (pu.x, pu.y), self.player.radius + 4, pu.radius):
                self.powerups.remove(pu)
                self.collect_powerup(pu)

    # ── drawing ─────────────────────────────────────────────────

    def draw_title(self):
        draw_ship(self.screen, SCREEN_W // 2, 135, 3.0)
        title = self.font_large.render("STAR ATTACK", True, COLORS["star_core"])
        self.screen.blit(title, title.get_rect(center=(SCREEN_W // 2, 245)))
        lines = [
            "Mouse / Arrows  -  Move",
            "SPACE / Click   -  Shoot",
            "M               -  Music On/Off",
        ]
        for i, line in enumerate(lines):
            surf = self.font_med.render(line, True, COLORS["white"])
            self.screen.blit(surf,
                             surf.get_rect(center=(SCREEN_W // 2, 310 + i * 36)))
        surf = self.font_small.render("Press SPACE or Click to Start",
                                      True, COLORS["yellow"])
        self.screen.blit(surf, surf.get_rect(center=(SCREEN_W // 2, SCREEN_H - 50)))

    def draw_hud(self):
        score = self.font_med.render(f"SCORE {self.player.score}",
                                     True, COLORS["white"])
        self.screen.blit(score, (10, 10))
        lives = self.font_med.render(f"LIVES {self.player.lives}",
                                     True, COLORS["pu_life"])
        self.screen.blit(lives, (10, 42))
        # lives as star icons (turn red + blink on the last ship)
        low = self.player.lives <= 1
        for i in range(self.player.lives):
            outer = COLORS["pu_life"] if low else COLORS["star_ship"]
            draw_star(self.screen, 20 + i * 20, 72, 7, 3.5, outer,
                      COLORS["star_core"])
        if low and int(pygame.time.get_ticks() / 350) % 2 == 0:
            warn = self.font_small.render("LAST SHIP!", True, COLORS["pu_life"])
            self.screen.blit(warn, (10, 84))
        wave = self.font_small.render(f"WAVE {max(1, self.wave_num)}",
                                      True, COLORS["yellow"])
        self.screen.blit(wave, (SCREEN_W - wave.get_width() - 15, 15))
        if self.player.mult > 1:
            mult = self.font_small.render(f"SCORE x{self.player.mult}",
                                          True, COLORS["green"])
            self.screen.blit(mult, (SCREEN_W - mult.get_width() - 15, 42))

    def draw_game_over(self):
        overlay = pygame.Surface((SCREEN_W, SCREEN_H))
        overlay.set_alpha(180)
        overlay.fill((0, 0, 0))
        self.screen.blit(overlay, (0, 0))

        title = self.font_large.render("GAME OVER", True, COLORS["boss"])
        self.screen.blit(title, title.get_rect(center=(SCREEN_W // 2, SCREEN_H // 3)))

        score = self.font_med.render(f"Final Score: {self.player.score}",
                                     True, COLORS["white"])
        self.screen.blit(score, score.get_rect(center=(SCREEN_W // 2, SCREEN_H // 2)))

        wave = self.font_small.render(f"Waves Reached: {self.wave_num}",
                                      True, COLORS["yellow"])
        self.screen.blit(wave, wave.get_rect(center=(SCREEN_W // 2, SCREEN_H // 2 + 40)))

        restart = self.font_small.render("Press R or SPACE to Restart",
                                         True, COLORS["white"])
        self.screen.blit(restart, restart.get_rect(center=(SCREEN_W // 2, SCREEN_H - 50)))

    def draw(self):
        self.screen.fill(COLORS["bg"])
        self.starfield.draw(self.screen)

        if self.game_state == "start":
            self.draw_title()
        else:
            for pu in self.powerups:
                pu.draw(self.screen, self.font_small)
            for b in self.bullets:
                pygame.draw.circle(self.screen, COLORS["bullet"],
                                   (int(b.x), int(b.y)), b.radius)
            for b in self.e_bullets:
                pygame.draw.circle(self.screen, COLORS["e_bullet"],
                                   (int(b.x), int(b.y)), b.radius)
            for e in self.enemies:
                e.draw(self.screen)
            for bo in self.bosses:
                bo.draw(self.screen)
            self.player.draw(self.screen)
            for p in self.particles:
                frac = p.life / 60
                c = tuple(int(ch * frac) for ch in p.color)
                pygame.draw.circle(self.screen, c,
                                   (int(p.x), int(p.y)), max(1, p.life // 6))
            self.draw_hud()

            if self.wave_msg_timer > 0:
                self.wave_msg_timer -= 1
                surf = self.font_med.render(self.wave_msg, True, COLORS["yellow"])
                self.screen.blit(surf, surf.get_rect(
                    center=(SCREEN_W // 2, SCREEN_H // 2 - 60)))

            # red flash while taking damage
            if self.damage_flash > 0:
                self._damage_overlay.set_alpha(int(80 * self.damage_flash / 10))
                self.screen.blit(self._damage_overlay, (0, 0))
                self.damage_flash -= 1

            if self.game_state == "gameover":
                self.draw_game_over()
            elif self.game_state == "levelup":
                self.draw_level_up()

    # ── main loop ───────────────────────────────────────────────

    def frame(self):
        """Advance the game by one frame. Returns False when the window is closed."""
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                return False
            if (event.type == pygame.KEYDOWN and event.key == pygame.K_m
                    and self.game_state != "gameover"):
                self.sounds.toggle_music()   # M = music on/off
                continue
            if self.game_state == "start":
                if event.type in (pygame.KEYDOWN, pygame.MOUSEBUTTONDOWN):
                    self.reset_game()
                    self.sounds.start_music()
                continue
            if self.game_state == "gameover" and event.type == pygame.KEYDOWN:
                if event.key in (pygame.K_r, pygame.K_SPACE):
                    self.reset_game()
                    self.sounds.start_music()
            elif self.game_state == "levelup" and event.type == pygame.KEYDOWN:
                if event.key == pygame.K_SPACE:
                    self.game_state = "playing"
                    self.level_up_state = "none"
            elif (self.game_state == "playing"
                    and event.type == pygame.MOUSEMOTION):
                # mouse steers the ship left/right
                self.mouse_active = True
                self.mouse_x = event.pos[0]

        if self.game_state == "playing":
            mx = self.mouse_x if self.mouse_active else None
            self.player.update(pygame.key.get_pressed(), mx)

        self.update()
        self.draw()
        pygame.display.flip()
        return True

    def run(self):
        while self.frame():
            self.clock.tick(FPS)
        pygame.quit()


# ─────────────────────────── Entry point ─────────────────────────
if __name__ == "__main__":
    StarAttackGame().run()