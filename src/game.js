const PLAYER_RADIUS = 15;
const PLAYER_SPEED = 390;
const POWERUP_COLORS = {
  life: "#ff80b5",
  mult: "#fff09a",
  speed: "#62f2dc",
  shield: "#79dcff",
};
const COLORS = {
  basic: "#c83cb4",
  fast: "#ff5570",
  tank: "#50e891",
  monster: "#ff8b4d",
  alien: "#62f2dc",
  raider: "#8b9dff",
};

const ENEMY_STATS = {
  basic: { radius: 14, hp: 1, score: 100 },
  fast: { radius: 13, hp: 1, score: 200 },
  tank: { radius: 18, hp: 3, score: 300 },
  monster: { radius: 19, hp: 4, score: 450 },
  alien: { radius: 16, hp: 2, score: 500 },
  raider: { radius: 18, hp: 3, score: 600 },
};

const LEVEL_INTROS = {
  2: "MONSTERS DETECTED",
  3: "ALIEN FIGHTERS INCOMING",
  4: "RAIDER SHIPS ATTACK",
  5: "ELITE ENEMIES INCOMING",
};

const LEVEL_INTRO_ENEMIES = {
  2: "monster",
  3: "alien",
  4: "raider",
};

export class StarAttackGame {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.stars = Array.from({ length: 90 }, () => this.makeStar(true));
    this.startRun();
    this.state = "start";
  }

  makeStar(randomY = false) {
    const size = Math.random() * 1.7 + 0.5;
    return {
      x: Math.random() * this.width,
      y: randomY ? Math.random() * this.height : -2,
      size,
      speed: 28 + size * 24,
    };
  }

  startRun() {
    this.score = 0;
    this.lives = 3;
    this.wave = 0;
    this.level = 1;
    this.pendingIntroEnemy = null;
    this.player = {
      x: this.width / 2,
      y: this.height - this.playerBottomInset(),
      radius: PLAYER_RADIUS,
      speed: 5,
      velocityX: 0,
      velocityY: 0,
      bank: 0,
    };
    this.bullets = [];
    this.missiles = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.bosses = [];
    this.lifeBubbles = [];
    this.shieldBubbles = [];
    this.shieldTimer = 0;
    this.shieldDuration = 0;
    this.particles = [];
    this.exhaustParticles = [];
    this.exhaustTimer = 0;
    this.fireTimer = 0;
    this.missileCooldown = 0;
    this.spawnTimer = 1.2;
    this.invulnerable = 0;
    this.levelNotice = "";
    this.levelNoticeTimer = 0;
    this.lifeNoticeTimer = 0;
    this.lifeBubbleAwards = 0;
    this.lifeBubbleSpawns = 0;
    this.powerups = [];
    this.multiplier = 1;
    this.damageFlash = 0;
    this.soundEvents = [];
    this.state = "playing";
  }

  resize(width, height) {
    const scaleX = width / this.width;
    const scaleY = height / this.height;
    this.width = width;
    this.height = height;
    this.player.x = Math.max(PLAYER_RADIUS, Math.min(width - PLAYER_RADIUS, this.player.x * scaleX));
    this.player.y = height - this.playerBottomInset();
    for (const entity of [
      ...this.bullets,
      ...this.missiles,
      ...this.enemyBullets,
      ...this.enemies,
      ...this.bosses,
      ...this.lifeBubbles,
      ...this.shieldBubbles,
      ...this.powerups,
      ...this.particles,
      ...this.exhaustParticles,
      ...this.stars,
    ]) {
      entity.x *= scaleX;
      entity.y *= scaleY;
      if (entity.originX !== undefined) entity.originX *= scaleX;
    }
  }

  playerBottomInset() {
    return 70;
  }

  playerVerticalBounds() {
    const bottom = Math.max(PLAYER_RADIUS, this.height - this.playerBottomInset());
    const top = Math.min(bottom, Math.max(PLAYER_RADIUS, this.height * 0.45));
    return { top, bottom };
  }

  update(deltaSeconds, input) {
    if (this.state !== "playing") return;
    const dt = Math.min(deltaSeconds, 0.05);

    for (const star of this.stars) {
      star.y += Math.max(0, star.speed - this.player.velocityY * 0.08) * dt;
      star.x -= this.player.velocityX * dt * (0.035 + star.size * 0.012);
      if (star.x < 0) star.x += this.width;
      else if (star.x > this.width) star.x -= this.width;
      if (star.y > this.height) Object.assign(star, this.makeStar());
    }

    const previousX = this.player.x;
    const previousY = this.player.y;
    if (input.pointerX !== null) {
      this.player.x = input.pointerX;
    } else if (input.left !== input.right) {
      this.player.x += (input.right ? 1 : -1) * PLAYER_SPEED * (this.player.speed / 5) * dt;
    }
    this.player.x = Math.max(PLAYER_RADIUS, Math.min(this.width - PLAYER_RADIUS, this.player.x));
    if (input.pointerY !== null) {
      this.player.y = input.pointerY;
    } else if (input.up !== input.down) {
      this.player.y += (input.down ? 1 : -1) * PLAYER_SPEED * (this.player.speed / 5) * dt;
    }
    const verticalBounds = this.playerVerticalBounds();
    this.player.y = Math.max(verticalBounds.top, Math.min(verticalBounds.bottom, this.player.y));
    const movementScale = PLAYER_SPEED * (this.player.speed / 5);
    const safeDt = Math.max(dt, 0.001);
    const targetVelocityX = Math.max(-movementScale, Math.min(movementScale, (this.player.x - previousX) / safeDt));
    const targetVelocityY = Math.max(-movementScale, Math.min(movementScale, (this.player.y - previousY) / safeDt));
    const velocityBlend = Math.min(1, dt * 12);
    this.player.velocityX += (targetVelocityX - this.player.velocityX) * velocityBlend;
    this.player.velocityY += (targetVelocityY - this.player.velocityY) * velocityBlend;
    const targetBank = Math.max(-0.38, Math.min(0.38, this.player.velocityX / movementScale * 0.38));
    this.player.bank += (targetBank - this.player.bank) * Math.min(1, dt * 9);

    this.exhaustTimer -= dt;
    while (this.exhaustTimer <= 0) {
      this.exhaustParticles.push({
        x: this.player.x + (Math.random() - 0.5) * 9,
        y: this.player.y + 13,
        vx: -this.player.velocityX * 0.16 + (Math.random() - 0.5) * 24,
        vy: 46 + Math.random() * 46 + Math.max(0, -this.player.velocityY) * 0.12,
        life: 0.28 + Math.random() * 0.26,
        maxLife: 0.54,
        radius: 2 + Math.random() * 3,
      });
      this.exhaustTimer += 0.025 + Math.random() * 0.035;
    }
    for (const particle of this.exhaustParticles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.life -= dt;
    }
    this.exhaustParticles = this.exhaustParticles.filter((particle) => particle.life > 0);

    this.fireTimer -= dt;
    if (input.fire && this.fireTimer <= 0) {
      if (this.level >= 3 && input.down && this.missileCooldown <= 0) {
        this.missiles.push({ x: this.player.x, y: this.player.y - 20, speed: 480, radius: 9, damage: 5 });
        this.missileCooldown = 3;
        this.soundEvents.push("missile");
      } else {
        this.bullets.push({ x: this.player.x - 8, y: this.player.y - 17, speed: 570, radius: 3 });
        this.bullets.push({ x: this.player.x + 8, y: this.player.y - 17, speed: 570, radius: 3 });
        if (this.multiplier >= 2) {
          this.bullets.push({ x: this.player.x, y: this.player.y - 21, speed: 600, radius: 3 });
        }
        this.soundEvents.push("shoot");
      }
      this.fireTimer = 0.17;
    }
    this.missileCooldown = Math.max(0, this.missileCooldown - dt);

    if (this.enemies.length === 0 && this.bosses.length === 0) {
      if (this.wave > 0 && this.wave % 10 === 0 && this.level === this.wave / 10) {
        this.advanceLevel();
      } else {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) this.spawnWave();
      }
    }

    for (const bullet of this.bullets) bullet.y -= bullet.speed * dt;
    this.bullets = this.bullets.filter((bullet) => bullet.y > -10);
    for (const missile of this.missiles) missile.y -= missile.speed * dt;
    this.missiles = this.missiles.filter((missile) => missile.y > -20);
    for (const bullet of this.enemyBullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
    }
    this.enemyBullets = this.enemyBullets.filter((bullet) =>
      bullet.y < this.height + 12 && bullet.x > -12 && bullet.x < this.width + 12,
    );
    this.shieldTimer = Math.max(0, this.shieldTimer - dt);

    for (const enemy of this.enemies) {
      enemy.y += enemy.speed * dt;
      enemy.phase += dt * 2;
    }
    for (const boss of this.bosses) {
      boss.phase += dt;
      boss.y = Math.min(96, boss.y + 35 * dt);
      boss.x = this.width / 2 + Math.sin(boss.phase * 0.7) * this.width * 0.28;
      boss.fireTimer -= dt;
      if (boss.fireTimer <= 0) {
        const angle = Math.atan2(this.player.y - boss.y, this.player.x - boss.x);
        for (const spread of [-0.16, 0, 0.16]) {
          this.enemyBullets.push({
            x: boss.x,
            y: boss.y + boss.radius * 0.65,
            vx: Math.cos(angle + spread) * 195,
            vy: Math.sin(angle + spread) * 195,
            radius: 5,
            type: "boss",
          });
        }
        boss.fireTimer = 0.8;
      }
    }

    for (const bubble of this.lifeBubbles) {
      bubble.y += bubble.speed * dt;
      bubble.phase += dt * 3;
      bubble.x = Math.max(
        bubble.radius,
        Math.min(this.width - bubble.radius, bubble.originX + Math.sin(bubble.phase) * 14),
      );
    }
    this.lifeBubbles = this.lifeBubbles.filter((bubble) => bubble.y < this.height + bubble.radius);
    for (const bubble of this.shieldBubbles) {
      bubble.y += bubble.speed * dt;
      bubble.phase += dt * 2.5;
      bubble.x = Math.max(
        bubble.radius,
        Math.min(this.width - bubble.radius, bubble.originX + Math.sin(bubble.phase) * 18),
      );
    }
    this.shieldBubbles = this.shieldBubbles.filter((bubble) => bubble.y < this.height + bubble.radius);
    for (const powerup of this.powerups) powerup.y += powerup.speed * dt;
    this.powerups = this.powerups.filter((powerup) => powerup.y < this.height + powerup.radius);

    for (const particle of this.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.life -= dt;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);
    this.lifeNoticeTimer = Math.max(0, this.lifeNoticeTimer - dt);
    this.levelNoticeTimer = Math.max(0, this.levelNoticeTimer - dt);
    this.damageFlash = Math.max(0, this.damageFlash - dt);

    this.updateEnemyAttacks(dt);
    this.resolveCollisions();
    this.enemies = this.enemies.filter((enemy) => enemy.y < this.height + enemy.radius);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
  }

  spawnPowerup(x, y, kind = ["life", "mult", "speed"][Math.floor(Math.random() * 3)]) {
    this.powerups.push({ x, y, kind, radius: 10, speed: 65 });
  }

  spawnWave() {
    this.wave += 1;
    this.soundEvents.push("wave");
    if (this.wave % 2 === 0 && this.lifeBubbles.length === 0) {
      const margin = Math.min(36, this.width * 0.15);
      const x = margin + Math.random() * Math.max(1, this.width - margin * 2);
      this.lifeBubbles.push({
        x,
        originX: x,
        y: -28,
        radius: 19,
        speed: 48,
        phase: Math.random() * Math.PI * 2,
      });
      this.lifeBubbleSpawns += 1;
      this.lifeNotice = "SHOOT PINK BUBBLE FOR +1 LIFE";
      this.lifeNoticeTimer = 3;
    }

    if (this.wave % 10 === 0) {
      const maxHp = 35 + this.level * 10;
      this.bosses.push({
        x: this.width / 2,
        y: -56,
        radius: 38,
        hp: maxHp,
        maxHp,
        phase: 0,
        fireTimer: 0.8,
      });
      const margin = Math.min(42, this.width * 0.15);
      const x = margin + Math.random() * Math.max(1, this.width - margin * 2);
      this.shieldBubbles.push({
        x,
        originX: x,
        y: Math.max(120, this.player.y - Math.min(300, this.height * 0.38)),
        radius: 19,
        speed: 58,
        phase: Math.random() * Math.PI * 2,
      });
      this.lifeNotice = "SHOOT BLUE BUBBLE FOR BOSS SHIELD";
      this.lifeNoticeTimer = 4;
      return;
    }

    const count = Math.min(5 + Math.floor(this.wave * 0.6) + this.level, 24);
    for (let i = 0; i < count; i += 1) {
      const type = i === 0 && this.pendingIntroEnemy
        ? this.pendingIntroEnemy
        : this.chooseEnemyType();
      const stats = ENEMY_STATS[type];
      this.enemies.push({
        x: 24 + Math.random() * Math.max(1, this.width - 48),
        y: -25 - i * 30,
        originX: 0,
        radius: stats.radius,
        speed: 50 + this.level * 7 + Math.min(this.wave, 15) * 2 + Math.random() * 18,
        hp: stats.hp,
        score: stats.score,
        type,
        phase: Math.random() * Math.PI * 2,
        fireTimer: 1.5 + Math.random() * 1.5,
      });
      this.enemies[this.enemies.length - 1].originX = this.enemies[this.enemies.length - 1].x;
    }
    this.pendingIntroEnemy = null;
    this.spawnTimer = 1.4;
  }

  chooseEnemyType() {
    const pool = ["basic", "basic", "basic", "fast", "fast", "tank"];
    if (this.level >= 2) pool.push("monster", "monster");
    if (this.level >= 3) pool.push("alien", "alien");
    if (this.level >= 4) pool.push("raider", "raider");
    if (this.level >= 5) pool.push("alien", "raider", "monster");
    return pool[Math.floor(Math.random() * pool.length)];
  }

  advanceLevel() {
    this.level += 1;
    this.levelNotice = `LEVEL ${this.level} · ${LEVEL_INTROS[this.level] ?? "MORE DANGEROUS ENEMIES"}`;
    this.pendingIntroEnemy = LEVEL_INTRO_ENEMIES[this.level] ?? "raider";
    this.levelNoticeTimer = 4;
    this.spawnTimer = 3;
    this.score += 500 * this.level;
    this.enemyBullets = [];
    this.invulnerable = Math.max(this.invulnerable, 1.5);
    this.soundEvents.push("level");
  }

  updateEnemyAttacks(dt) {
    for (const enemy of this.enemies) {
      if (enemy.type === "fast") {
        enemy.x += Math.sin(enemy.phase) * 65 * dt;
      } else if (enemy.type === "raider") {
        enemy.x = Math.max(
          enemy.radius,
          Math.min(this.width - enemy.radius, enemy.originX + Math.sin(enemy.phase * 0.7) * 70),
        );
      } else if (enemy.type === "alien") {
        enemy.x = Math.max(
          enemy.radius,
          Math.min(this.width - enemy.radius, enemy.originX + Math.sin(enemy.phase * 0.5) * 35),
        );
      } else if (enemy.type === "monster") {
        enemy.x = Math.max(
          enemy.radius,
          Math.min(this.width - enemy.radius, enemy.originX + Math.sin(enemy.phase * 1.2) * 50),
        );
      }

      enemy.fireTimer -= dt;
      if (enemy.fireTimer > 0) continue;

      if (enemy.type !== "alien" && enemy.type !== "raider") {
        this.enemyBullets.push({
          x: enemy.x,
          y: enemy.y + enemy.radius,
          vx: 0,
          vy: 170 + this.level * 8,
          radius: 4,
          type: enemy.type,
        });
        enemy.fireTimer = 3 + Math.random() * 2;
        continue;
      }

      const dx = this.player.x - enemy.x;
      const dy = this.player.y - enemy.y;
      const angle = Math.atan2(dy, dx);
      const speed = 150 + this.level * 8;
      const spread = enemy.type === "raider" ? [-0.18, 0, 0.18] : [0];
      for (const offset of spread) {
        this.enemyBullets.push({
          x: enemy.x,
          y: enemy.y + enemy.radius,
          vx: Math.cos(angle + offset) * speed,
          vy: Math.sin(angle + offset) * speed,
          radius: enemy.type === "raider" ? 5 : 4,
          type: enemy.type,
        });
      }
      enemy.fireTimer = (enemy.type === "raider" ? 2.2 : 2.8) + Math.random() * 0.7;
    }
  }

  resolveCollisions() {
    for (const bullet of this.bullets) {
      const lifeBubble = this.lifeBubbles.find((candidate) => !candidate.hit &&
        Math.hypot(candidate.x - bullet.x, candidate.y - bullet.y) <
        candidate.radius + bullet.radius,
      );
      if (lifeBubble) {
        bullet.hit = true;
        lifeBubble.hit = true;
        this.restoreLife();
        this.soundEvents.push("powerup");
        this.burst(lifeBubble.x, lifeBubble.y, "#ff80b5");
        continue;
      }

      const shieldBubble = this.shieldBubbles.find((candidate) => !candidate.hit &&
        Math.hypot(candidate.x - bullet.x, candidate.y - bullet.y) <
        candidate.radius + bullet.radius,
      );
      if (shieldBubble) {
        bullet.hit = true;
        shieldBubble.hit = true;
        this.activateBossShield(shieldBubble.x, shieldBubble.y);
        continue;
      }

      const boss = this.bosses.find((candidate) => !candidate.dead &&
        Math.hypot(candidate.x - bullet.x, candidate.y - bullet.y) < candidate.radius + bullet.radius,
      );
      if (boss) {
        bullet.hit = true;
        this.damageBoss(boss, 1);
        continue;
      }

      const enemy = this.enemies.find((candidate) =>
        !candidate.dead &&
        Math.hypot(candidate.x - bullet.x, candidate.y - bullet.y) < candidate.radius + bullet.radius,
      );
      if (!enemy) continue;
      bullet.hit = true;
      this.damageEnemy(enemy, 1, false);
    }
    this.bullets = this.bullets.filter((bullet) => !bullet.hit);
    for (const missile of this.missiles) {
      const boss = this.bosses.find((candidate) => !candidate.dead &&
        Math.hypot(candidate.x - missile.x, candidate.y - missile.y) < candidate.radius + missile.radius,
      );
      if (boss) {
        missile.hit = true;
        this.damageBoss(boss, missile.damage);
        continue;
      }
      const enemy = this.enemies.find((candidate) =>
        !candidate.dead &&
        Math.hypot(candidate.x - missile.x, candidate.y - missile.y) < candidate.radius + missile.radius,
      );
      if (!enemy) continue;
      missile.hit = true;
      this.damageEnemy(enemy, missile.damage, true);
    }
    this.missiles = this.missiles.filter((missile) => !missile.hit);
    this.lifeBubbles = this.lifeBubbles.filter((bubble) => !bubble.hit);
    this.enemies = this.enemies.filter((enemy) => !enemy.dead);
    this.bosses = this.bosses.filter((boss) => !boss.dead);

    this.shieldBubbles = this.shieldBubbles.filter((bubble) => !bubble.hit);

    for (const powerup of this.powerups) {
      if (powerup.hit || Math.hypot(powerup.x - this.player.x, powerup.y - this.player.y) >= powerup.radius + this.player.radius) continue;
      powerup.hit = true;
      if (powerup.kind === "life") {
        this.restoreLife();
      } else if (powerup.kind === "mult") {
        this.multiplier = Math.min(5, this.multiplier + 1);
        this.lifeNotice = `SCORE MULTIPLIER x${this.multiplier}`;
        this.lifeNoticeTimer = 2.2;
      } else {
        this.player.speed = Math.min(9, this.player.speed + 1);
        this.lifeNotice = `SPEED ${this.player.speed}/9`;
        this.lifeNoticeTimer = 2.2;
      }
      this.soundEvents.push("powerup");
      this.burst(powerup.x, powerup.y, POWERUP_COLORS[powerup.kind]);
    }
    this.powerups = this.powerups.filter((powerup) => !powerup.hit);

    for (const enemy of this.enemies) {
      if (enemy.y > this.height - 15) {
        enemy.dead = true;
        this.loseLife();
      } else if (
        this.invulnerable <= 0 &&
        this.shieldTimer <= 0 &&
        Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y) < enemy.radius + this.player.radius
      ) {
        enemy.dead = true;
        this.burst(enemy.x, enemy.y, COLORS[enemy.type]);
        this.loseLife();
      }
    }
    if (this.invulnerable <= 0 && this.shieldTimer <= 0) {
      const boss = this.bosses.find((candidate) =>
        Math.hypot(candidate.x - this.player.x, candidate.y - this.player.y) <
        candidate.radius + this.player.radius,
      );
      if (boss) this.loseLife();
    }
    this.enemies = this.enemies.filter((enemy) => !enemy.dead);

    if (this.invulnerable <= 0 && this.shieldTimer <= 0) {
      const bulletIndex = this.enemyBullets.findIndex((bullet) =>
        Math.hypot(bullet.x - this.player.x, bullet.y - this.player.y) <
        bullet.radius + this.player.radius,
      );
      if (bulletIndex !== -1) {
        const [bullet] = this.enemyBullets.splice(bulletIndex, 1);
        this.burst(bullet.x, bullet.y, COLORS[bullet.type] ?? "#ff6575");
        this.loseLife();
      }
    }
  }

  damageEnemy(enemy, damage, piercing) {
    if (enemy.type === "alien" && !piercing) {
      this.burst(enemy.x, enemy.y, "#b8ffff");
      return;
    }
    enemy.hp -= damage;
    if (enemy.hp > 0) return;
    enemy.dead = true;
    this.score += enemy.score * this.multiplier;
    this.burst(enemy.x, enemy.y, COLORS[enemy.type]);
    this.soundEvents.push("explosion");
    if (Math.random() < 0.08) this.spawnPowerup(enemy.x, enemy.y);
  }

  damageBoss(boss, damage) {
    if (boss.dead) return;
    boss.hp -= damage;
    if (boss.hp > 0) return;
    boss.dead = true;
    this.score += 500 * this.multiplier;
    this.burst(boss.x, boss.y, "#ff505c");
    this.spawnPowerup(boss.x - 24, boss.y, "life");
    this.spawnPowerup(boss.x + 24, boss.y, "mult");
    this.soundEvents.push("explosion");
  }

  loseLife() {
    if (this.invulnerable > 0 || this.state !== "playing") return;
    this.lives -= 1;
    this.invulnerable = 1.5;
    this.damageFlash = 0.22;
    this.burst(this.player.x, this.player.y, "#ff6680");
    this.soundEvents.push("hit");
    if (this.lives <= 0) {
      this.state = "gameover";
      this.soundEvents.push("gameover");
    }
  }

  restoreLife() {
    if (this.lives < 9) {
      this.lives += 1;
      this.lifeNotice = "LIFE +1";
    } else {
      this.score += 100;
      this.lifeNotice = "MAX LIVES · BONUS +100";
    }
    this.lifeNoticeTimer = 2.2;
    this.lifeBubbleAwards += 1;
  }

  activateBossShield(x, y) {
    this.shieldDuration = Math.max(10, 15 - Math.floor((this.level - 1) / 2));
    this.shieldTimer = this.shieldDuration;
    this.lifeNotice = `BOSS SHIELD ${this.shieldDuration}s`;
    this.lifeNoticeTimer = 2.5;
    this.soundEvents.push("powerup");
    this.burst(x, y, POWERUP_COLORS.shield);
  }

  burst(x, y, color) {
    for (let i = 0; i < 10; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 35 + Math.random() * 130;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.35 + Math.random() * 0.4,
        color,
      });
    }
  }
}
