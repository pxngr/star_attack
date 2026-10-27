const SHIP_GOLD = "#ffbf4f";

export class GameRenderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d", { alpha: false });
    this.game = game;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.game.resize(rect.width, rect.height);
  }

  draw() {
    const ctx = this.context;
    const game = this.game;
    ctx.clearRect(0, 0, game.width, game.height);
    ctx.fillStyle = "#0c0c1e";
    ctx.fillRect(0, 0, game.width, game.height);

    for (const star of game.stars) {
      const velocity = Math.abs(game.player.velocityX) + Math.abs(game.player.velocityY);
      const trailLength = star.speed * 0.035 + velocity * 0.012;
      ctx.globalAlpha = 0.3 + star.size * 0.2;
      ctx.strokeStyle = "#d9e9ff";
      ctx.lineWidth = Math.max(0.6, star.size * 0.65);
      ctx.beginPath();
      ctx.moveTo(star.x, star.y - trailLength);
      ctx.lineTo(star.x, star.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    for (const bullet of game.bullets) {
      ctx.fillStyle = "#ff9c50";
      ctx.shadowColor = "#ff7545";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    for (const missile of game.missiles) this.drawMissile(missile);

    for (const bullet of game.enemyBullets) this.drawEnemyBullet(bullet);
    for (const enemy of game.enemies) this.drawEnemy(enemy);
    for (const powerup of game.powerups) this.drawPowerup(powerup);
    for (const bubble of game.lifeBubbles) this.drawLifeBubble(bubble);
    for (const bubble of game.shieldBubbles) this.drawShieldBubble(bubble);
    for (const boss of game.bosses) this.drawBoss(boss);
    for (const particle of game.particles) {
      ctx.globalAlpha = Math.min(1, particle.life * 2);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x - 2, particle.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
    this.drawExhaust(game.exhaustParticles);

    if (game.state === "playing") {
      this.drawShip(
        game.player.x,
        game.player.y,
        game.invulnerable > 0,
        game.player.bank,
        game.shieldTimer > 0,
      );
      this.drawHud();
      if (game.damageFlash > 0) {
        ctx.fillStyle = `rgb(255 45 30 / ${Math.min(0.28, game.damageFlash * 1.25)})`;
        ctx.fillRect(0, 0, game.width, game.height);
      }
    } else if (game.state === "start") {
      this.drawShip(game.width / 2, game.height * 0.34, false, 0);
    } else if (game.state === "gameover") {
      this.drawHud();
    }
  }

  drawExhaust(particles) {
    const ctx = this.context;
    for (const particle of particles) {
      const alpha = Math.max(0, particle.life / particle.maxLife);
      const radius = particle.radius * (0.45 + alpha * 0.65);
      const gradient = ctx.createRadialGradient(
        particle.x, particle.y, 0, particle.x, particle.y, radius * 2.4,
      );
      gradient.addColorStop(0, `rgb(255 246 180 / ${alpha * 0.92})`);
      gradient.addColorStop(0.28, `rgb(255 151 52 / ${alpha * 0.76})`);
      gradient.addColorStop(0.7, `rgb(255 67 30 / ${alpha * 0.28})`);
      gradient.addColorStop(1, "rgb(255 67 30 / 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, radius * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawShip(x, y, invulnerable, bank = 0, shielded = false) {
    const ctx = this.context;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(bank);
    ctx.shadowColor = "#ffb84d";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#ff8c42";
    ctx.beginPath();
    ctx.moveTo(-6, 9);
    ctx.lineTo(0, 21 + 2.5 * Math.sin(performance.now() / 45));
    ctx.lineTo(6, 9);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#d29a35";
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.lineTo(-18, 11);
    ctx.lineTo(-14, 14);
    ctx.lineTo(-5, 9);
    ctx.moveTo(5, 0);
    ctx.lineTo(18, 11);
    ctx.lineTo(14, 14);
    ctx.lineTo(5, 9);
    ctx.fill();
    ctx.fillStyle = "#ff6570";
    ctx.beginPath();
    ctx.moveTo(-18, 11);
    ctx.lineTo(-14, 14);
    ctx.lineTo(-13, 10);
    ctx.moveTo(18, 11);
    ctx.lineTo(14, 14);
    ctx.lineTo(13, 10);
    ctx.fill();
    ctx.fillStyle = SHIP_GOLD;
    ctx.beginPath();
    ctx.moveTo(0, -21);
    ctx.lineTo(7, 5);
    ctx.lineTo(15, 12);
    ctx.lineTo(7, 13);
    ctx.lineTo(0, 9);
    ctx.lineTo(-7, 13);
    ctx.lineTo(-15, 12);
    ctx.lineTo(-7, 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff0a8";
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(2, 8);
    ctx.lineTo(-2, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#80e8ff";
    ctx.beginPath();
    ctx.ellipse(0, -3, 3, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    if (invulnerable || shielded) {
      const pulse = 1 + Math.sin(performance.now() / (shielded ? 100 : 125)) * 0.035;
      ctx.globalAlpha = 0.8;
      ctx.scale(pulse, pulse);
      ctx.strokeStyle = shielded ? "rgb(116 224 255 / 95%)" : "rgb(195 238 255 / 90%)";
      ctx.fillStyle = shielded ? "rgb(70 192 255 / 18%)" : "rgb(110 205 255 / 14%)";
      ctx.shadowColor = shielded ? "#40cfff" : "#b5e9ff";
      ctx.shadowBlur = shielded ? 20 : 8;
      ctx.lineWidth = shielded ? 2.5 : 2;
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  drawEnemy(enemy) {
    const ctx = this.context;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate(["tank", "monster", "alien", "raider"].includes(enemy.type) ? enemy.phase * 0.2 : 0);
    const bodyGradient = ctx.createLinearGradient(0, -enemy.radius, 0, enemy.radius + 5);
    bodyGradient.addColorStop(0, "#ffffff");
    bodyGradient.addColorStop(0.16, this.mixColor(COLORS[enemy.type], "#ffffff", 0.48));
    bodyGradient.addColorStop(0.58, COLORS[enemy.type]);
    bodyGradient.addColorStop(1, this.mixColor(COLORS[enemy.type], "#080b20", 0.55));
    ctx.fillStyle = "rgb(0 0 0 / 35%)";
    ctx.beginPath();
    ctx.ellipse(2, enemy.radius + 4, enemy.radius * 0.86, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = bodyGradient;
    ctx.shadowColor = COLORS[enemy.type];
    ctx.shadowBlur = 9;
    ctx.beginPath();
    if (enemy.type === "fast") {
      ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
    } else if (enemy.type === "tank") {
      for (let i = 0; i < 6; i += 1) {
        const angle = (Math.PI * 2 * i) / 6;
        const x = Math.cos(angle) * enemy.radius;
        const y = Math.sin(angle) * enemy.radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    } else if (enemy.type === "monster") {
      this.drawSpikedShape(ctx, enemy.radius, 12, 0.62);
      ctx.fill();
      ctx.fillStyle = "#ffe0a0";
      ctx.beginPath();
      ctx.arc(-6, -2, 2.5, 0, Math.PI * 2);
      ctx.arc(6, -2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.type === "alien") {
      ctx.moveTo(0, -enemy.radius);
      ctx.quadraticCurveTo(enemy.radius * 1.4, -4, enemy.radius, 6);
      ctx.quadraticCurveTo(0, enemy.radius + 7, -enemy.radius, 6);
      ctx.quadraticCurveTo(-enemy.radius * 1.4, -4, 0, -enemy.radius);
      ctx.fill();
      ctx.strokeStyle = "#d3fff9";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, enemy.radius + 5, 6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#eaffff";
      ctx.beginPath();
      ctx.arc(0, -2, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.type === "raider") {
      ctx.moveTo(0, -enemy.radius);
      ctx.lineTo(enemy.radius * 0.48, -2);
      ctx.lineTo(enemy.radius, 9);
      ctx.lineTo(enemy.radius * 0.3, 6);
      ctx.lineTo(0, 14);
      ctx.lineTo(-enemy.radius * 0.3, 6);
      ctx.lineTo(-enemy.radius, 9);
      ctx.lineTo(-enemy.radius * 0.48, -2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#e2e5ff";
      ctx.fillRect(-2, -10, 4, 11);
    } else {
      for (let i = 0; i < 10; i += 1) {
        const angle = (Math.PI * 2 * i) / 10 - Math.PI / 2;
        const radius = i % 2 === 0 ? enemy.radius : enemy.radius * 0.52;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = "screen";
    const gloss = ctx.createRadialGradient(
      -enemy.radius * 0.3, -enemy.radius * 0.45, 0,
      -enemy.radius * 0.3, -enemy.radius * 0.45, enemy.radius * 0.95,
    );
    gloss.addColorStop(0, "rgb(255 255 255 / 70%)");
    gloss.addColorStop(0.25, "rgb(255 255 255 / 25%)");
    gloss.addColorStop(1, "rgb(255 255 255 / 0%)");
    ctx.fillStyle = gloss;
    ctx.beginPath();
    ctx.ellipse(
      -enemy.radius * 0.22, -enemy.radius * 0.38,
      enemy.radius * 0.62, enemy.radius * 0.34, -0.3, 0, Math.PI * 2,
    );
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = "rgb(255 255 255 / 40%)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(0, 0, enemy.radius * 0.82, enemy.radius * 0.63, 0, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();

    if (enemy.type === "monster" || enemy.type === "alien" || enemy.type === "raider") {
      const maxHp = ENEMY_MAX_HP[enemy.type];
      const barWidth = enemy.radius * 1.5;
      ctx.fillStyle = "rgb(5 8 20 / 75%)";
      ctx.fillRect(-barWidth / 2, enemy.radius + 7, barWidth, 3);
      ctx.fillStyle = COLORS[enemy.type];
      ctx.fillRect(-barWidth / 2, enemy.radius + 7, barWidth * (enemy.hp / maxHp), 3);
    }
    ctx.restore();
  }

  drawSpikedShape(ctx, radius, points, innerRatio) {
    for (let i = 0; i < points * 2; i += 1) {
      const angle = (Math.PI * 2 * i) / (points * 2) - Math.PI / 2;
      const length = i % 2 === 0 ? radius : radius * innerRatio;
      const x = Math.cos(angle) * length;
      const y = Math.sin(angle) * length;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  drawEnemyBullet(bullet) {
    const ctx = this.context;
    ctx.save();
    ctx.fillStyle = COLORS[bullet.type] ?? "#ff6575";
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawMissile(missile) {
    const ctx = this.context;
    ctx.save();
    ctx.translate(missile.x, missile.y);
    ctx.fillStyle = "#fff09a";
    ctx.shadowColor = "#ff9c50";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(6, 8);
    ctx.lineTo(0, 5);
    ctx.lineTo(-6, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawLifeBubble(bubble) {
    const ctx = this.context;
    const pulse = 1 + Math.sin(bubble.phase * 2) * 0.06;
    ctx.save();
    ctx.translate(bubble.x, bubble.y);
    ctx.scale(pulse, pulse);
    ctx.shadowColor = "#ff70ad";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "rgb(255 90 160 / 25%)";
    ctx.strokeStyle = "#ff9bc8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, bubble.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff0f6";
    ctx.beginPath();
    ctx.moveTo(0, 7);
    ctx.bezierCurveTo(-15, -2, -8, -11, 0, -4);
    ctx.bezierCurveTo(8, -11, 15, -2, 0, 7);
    ctx.fill();
    ctx.restore();
  }

  drawShieldBubble(bubble) {
    const ctx = this.context;
    const pulse = 1 + Math.sin(bubble.phase * 2) * 0.08;
    ctx.save();
    ctx.translate(bubble.x, bubble.y);
    ctx.scale(pulse, pulse);
    ctx.shadowColor = "#48d9ff";
    ctx.shadowBlur = 18;
    const shell = ctx.createRadialGradient(-7, -9, 2, 0, 0, bubble.radius);
    shell.addColorStop(0, "rgb(235 255 255 / 92%)");
    shell.addColorStop(0.22, "rgb(100 227 255 / 64%)");
    shell.addColorStop(0.7, "rgb(44 160 255 / 20%)");
    shell.addColorStop(1, "rgb(55 200 255 / 8%)");
    ctx.fillStyle = shell;
    ctx.strokeStyle = "#a3f2ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, bubble.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(-6, -8, 4, 2, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgb(255 255 255 / 70%)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, bubble.radius - 5, Math.PI * 1.15, Math.PI * 1.72);
    ctx.stroke();
    ctx.restore();
  }

  drawPowerup(powerup) {
    const ctx = this.context;
    const color = POWERUP_COLORS[powerup.kind];
    ctx.save();
    ctx.translate(powerup.x, powerup.y);
    ctx.fillStyle = `${color}33`;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(0, 0, powerup.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 12px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(powerup.kind === "life" ? "+" : powerup.kind === "mult" ? "x" : "S", 0, 0);
    ctx.restore();
  }

  drawBoss(boss) {
    const ctx = this.context;
    ctx.save();
    ctx.translate(boss.x, boss.y);
    const hull = ctx.createLinearGradient(0, -boss.radius, 0, boss.radius);
    hull.addColorStop(0, "#ffe2cc");
    hull.addColorStop(0.18, "#ff9b89");
    hull.addColorStop(0.55, "#ff505c");
    hull.addColorStop(1, "#7d183e");
    ctx.fillStyle = "rgb(0 0 0 / 38%)";
    ctx.beginPath();
    ctx.ellipse(3, boss.radius * 0.72, boss.radius * 0.78, boss.radius * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hull;
    ctx.shadowColor = "#ff505c";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(0, -boss.radius);
    ctx.lineTo(boss.radius * 0.65, -boss.radius * 0.2);
    ctx.lineTo(boss.radius, boss.radius * 0.55);
    ctx.lineTo(boss.radius * 0.35, boss.radius * 0.4);
    ctx.lineTo(0, boss.radius);
    ctx.lineTo(-boss.radius * 0.35, boss.radius * 0.4);
    ctx.lineTo(-boss.radius, boss.radius * 0.55);
    ctx.lineTo(-boss.radius * 0.65, -boss.radius * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = "screen";
    const reflection = ctx.createRadialGradient(-12, -20, 1, -8, -15, boss.radius * 0.9);
    reflection.addColorStop(0, "rgb(255 255 255 / 75%)");
    reflection.addColorStop(0.22, "rgb(255 205 196 / 30%)");
    reflection.addColorStop(1, "rgb(255 255 255 / 0%)");
    ctx.fillStyle = reflection;
    ctx.beginPath();
    ctx.ellipse(-10, -boss.radius * 0.35, boss.radius * 0.48, boss.radius * 0.22, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#fff09a";
    ctx.shadowColor = "#fff09a";
    ctx.shadowBlur = 9;
    ctx.fillRect(-6, -8, 12, 8);
    ctx.restore();
    const width = Math.min(220, this.game.width * 0.6);
    const x = (this.game.width - width) / 2;
    const y = Math.max(12, boss.y - boss.radius - 18);
    ctx.fillStyle = "rgb(5 8 20 / 80%)";
    ctx.fillRect(x, y, width, 6);
    ctx.fillStyle = "#ff505c";
    ctx.fillRect(x, y, width * Math.max(0, boss.hp / boss.maxHp), 6);
  }

  drawHud() {
    const ctx = this.context;
    const game = this.game;
    const hudLeft = Math.min(120, Math.max(14, game.width * 0.32));
    ctx.save();
    ctx.font = "700 16px ui-monospace, monospace";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`SCORE ${game.score}`, hudLeft, 14);
    ctx.fillStyle = "#ff80aa";
    ctx.fillText(`LIVES ${game.lives}/9`, hudLeft, 38);
    if (game.multiplier > 1 || game.player.speed > 5) {
      ctx.font = "700 12px ui-monospace, monospace";
      ctx.fillStyle = game.multiplier > 1 ? "#fff09a" : "#62f2dc";
      ctx.fillText(`SCORE x${game.multiplier}  SPEED ${game.player.speed}/9`, hudLeft, 60);
    }
    ctx.fillStyle = "#fff09a";
    ctx.textAlign = "right";
    ctx.fillText(`WAVE ${Math.max(1, game.wave)}`, game.width - 14, 14);
    ctx.fillStyle = "#b8c6ff";
    ctx.font = "700 12px ui-monospace, monospace";
    ctx.fillText(`LEVEL ${game.level}`, game.width - 14, 36);
    if (game.shieldTimer > 0) {
      ctx.textAlign = "center";
      ctx.font = "700 13px ui-monospace, monospace";
      ctx.fillStyle = "#9ceeff";
      ctx.shadowColor = "#39cfff";
      ctx.shadowBlur = 12;
      ctx.fillText(`SHIELD ACTIVE · ${Math.ceil(game.shieldTimer)}s`, game.width / 2, 84);
      ctx.shadowBlur = 0;
    }
    if (game.lifeNoticeTimer > 0) {
      ctx.textAlign = "center";
      ctx.font = "700 13px ui-monospace, monospace";
      const noticeY = game.shieldTimer > 0 ? 104 : 84;
      const isLifeNotice = /LIVES?/i.test(game.lifeNotice);
      const isShieldNotice = /SHIELD/i.test(game.lifeNotice);
      ctx.fillStyle = isLifeNotice ? "#ffb4d3" : isShieldNotice ? "#9ceeff" : "#fff09a";
      ctx.shadowColor = isLifeNotice ? "#ff70ad" : isShieldNotice ? "#39cfff" : "#fff09a";
      ctx.shadowBlur = 12;
      ctx.fillText(`${isLifeNotice ? "♥  " : isShieldNotice ? "◈  " : ""}${game.lifeNotice}`, game.width / 2, noticeY);
      ctx.shadowBlur = 0;
    }
    if (game.levelNoticeTimer > 0) {
      ctx.textAlign = "center";
      const bannerSize = Math.min(18, game.width / (game.levelNotice.length * 0.62));
      ctx.font = `800 ${bannerSize}px ui-monospace, monospace`;
      ctx.fillStyle = "#e1e7ff";
      ctx.shadowColor = "#8b9dff";
      ctx.shadowBlur = 18;
      ctx.fillText(game.levelNotice, game.width / 2, game.height * 0.22);
      ctx.shadowBlur = 0;
      ctx.font = "600 12px ui-monospace, monospace";
      ctx.fillStyle = "#c5cbe0";
      ctx.fillText("ENEMY SPEED AND ATTACKS INCREASED", game.width / 2, game.height * 0.22 + 25);
    }
    ctx.restore();
  }

  mixColor(color, target, amount) {
    const parse = (value) => value.match(/[a-f\d]{2}/gi).map((part) => Number.parseInt(part, 16));
    const from = parse(color);
    const to = parse(target);
    return `rgb(${from.map((channel, index) => Math.round(channel + (to[index] - channel) * amount)).join(" ")})`;
  }
}

const COLORS = {
  basic: "#c83cb4",
  fast: "#ff5570",
  tank: "#50e891",
  monster: "#ff8b4d",
  alien: "#62f2dc",
  raider: "#8b9dff",
};

const ENEMY_MAX_HP = {
  monster: 4,
  alien: 2,
  raider: 3,
};

const POWERUP_COLORS = {
  life: "#ff80b5",
  mult: "#fff09a",
  speed: "#62f2dc",
  shield: "#79dcff",
};
