import { RetroAudio } from "./audio.js";
import { StarAttackGame } from "./game.js";
import { InputController } from "./input.js";
import { PlayablesBridge } from "./platform.js";
import { GameRenderer } from "./renderer.js";

const canvas = document.querySelector("#playfield");
const startPanel = document.querySelector("#start-panel");
const gameoverPanel = document.querySelector("#gameover-panel");
const pausePanel = document.querySelector("#pause-panel");
const leaderboardPanel = document.querySelector("#leaderboard-panel");
const finalScore = document.querySelector("#final-score");
const status = document.querySelector("#sr-status");
const utilityControls = document.querySelector("#game-utility-controls");
const musicButton = document.querySelector("#music-button");
const pauseButton = document.querySelector("#pause-button");
const playerNameInput = document.querySelector("#player-name");
const pilotNameEntry = document.querySelector("#pilot-name-entry");
const startForm = document.querySelector("#start-form");
const leaderboardList = document.querySelector("#leaderboard-list");
const leaderboardEmpty = document.querySelector("#leaderboard-empty");
const game = new StarAttackGame(canvas.clientWidth, canvas.clientHeight);
const audio = new RetroAudio();
const STORAGE_KEY = "star-attack-leaderboard-v1";
const MAX_SCORES = 10;
const input = new InputController(canvas);
const renderer = new GameRenderer(canvas, game);
let paused = false;
let userPaused = false;
let systemPaused = false;
let frameScheduled = false;
let animationFrameId = null;
let lastTime = performance.now();
let gameoverAnnounced = false;
let announcedLifeAwards = 0;
let announcedLifeBubbleSpawns = 0;
let announcedLevel = 1;
let playerName = "";
let leaderboard = [];
let highScore = 0;
let highestLevelReached = 1;
let highestWaveReached = 0;
let persistenceReady = false;
let leaderboardReturnPanel = startPanel;

function updateUtilityControlVisibility() {
  utilityControls.hidden = game.state !== "playing" || paused || !leaderboardPanel.hidden;
  pauseButton.hidden = game.state !== "playing" || paused || !leaderboardPanel.hidden;
}

updateUtilityControlVisibility();

function startRun(name = playerName) {
  playerName = name;
  input.reset();
  audio.start();
  game.startRun();
  announcedLifeAwards = 0;
  announcedLifeBubbleSpawns = 0;
  announcedLevel = game.level;
  gameoverPanel.hidden = true;
  pausePanel.hidden = true;
  leaderboardPanel.hidden = true;
  startPanel.hidden = true;
  userPaused = false;
  paused = systemPaused;
  updateUtilityControlVisibility();
  canvas.focus();
  gameoverAnnounced = false;
  status.textContent = `Game started. Pilot ${playerName}. Move in any direction and hold to fire.`;
  void persistProfile();
  scheduleFrame();
}

function toggleMusic() {
  if (!audio.context) return;
  const enabled = audio.toggleMusic();
  musicButton.setAttribute("aria-label", `Turn music ${enabled ? "off" : "on"}`);
  musicButton.title = `Turn music ${enabled ? "off" : "on"}`;
  musicButton.setAttribute("aria-pressed", String(enabled));
  status.textContent = `Music ${enabled ? "on" : "off"}. Sound effects remain enabled.`;
}

startForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = platform.inPlayables ? "Pilot" : playerNameInput.value.trim();
  if (!name) {
    playerNameInput.setCustomValidity("Enter a pilot name to start.");
    playerNameInput.reportValidity();
    return;
  }
  playerNameInput.setCustomValidity("");
  startRun(name);
});
document.querySelector("#restart-button").addEventListener("click", () => startRun());
musicButton.addEventListener("click", toggleMusic);

function updatePauseState() {
  paused = userPaused || systemPaused;
  pausePanel.hidden = !userPaused || game.state !== "playing";
  pauseButton.hidden = game.state !== "playing" || paused || !leaderboardPanel.hidden;
  updateUtilityControlVisibility();
  if (paused) {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
      frameScheduled = false;
    }
    input.reset();
    audio.pause();
    renderer.draw();
  } else {
    lastTime = performance.now();
    if (game.state !== "gameover") audio.resume();
    scheduleFrame();
  }
}

function setPaused(nextPaused) {
  userPaused = nextPaused;
  document.querySelector("#pause-player").textContent = `Pilot: ${playerName}`;
  updatePauseState();
  if (nextPaused) void persistProfile();
  status.textContent = nextPaused ? "Game paused." : "Game resumed.";
  if (nextPaused) document.querySelector("#resume-button").focus();
  else canvas.focus();
}

function togglePause() {
  if (game.state !== "playing" || systemPaused || !leaderboardPanel.hidden) return;
  setPaused(!userPaused);
}

pauseButton.addEventListener("click", togglePause);
document.querySelector("#resume-button").addEventListener("click", () => {
  if (!userPaused) return;
  setPaused(false);
});
window.addEventListener("keydown", (event) => {
  if (event.code === "Escape" && !event.repeat) {
    if (leaderboardPanel.hidden && game.state !== "playing") return;
    if (!leaderboardPanel.hidden) {
      closeLeaderboard();
      return;
    }
    togglePause();
  }
});

function renderLeaderboard() {
  leaderboardList.replaceChildren();
  const scores = leaderboard.slice(0, MAX_SCORES);
  leaderboardEmpty.hidden = scores.length > 0;
  for (const [index, entry] of scores.entries()) {
    const item = document.createElement("li");
    const pilot = document.createElement("span");
    const score = document.createElement("strong");
    pilot.textContent = `${index + 1}. ${entry.name}`;
    score.textContent = String(entry.score);
    item.append(pilot, score);
    leaderboardList.append(item);
  }
}

function normalizeSave(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {
      version: 1,
      playerName: "",
      highestLevel: 1,
      highestWave: 0,
      highScore: 0,
      updatedAt: 0,
      scores: [],
    };
  }
  const records = Array.isArray(data.scores) ? data.scores : [];
  const scores = records.filter((entry) =>
    entry && (entry.name === undefined || (typeof entry.name === "string" && entry.name.trim())) &&
    Number.isSafeInteger(entry.score) && entry.score >= 0,
  ).map((entry) => ({
    name: typeof entry.name === "string" ? entry.name.trim().slice(0, 20) : "Pilot",
    score: entry.score,
    wave: Number.isSafeInteger(entry.wave) && entry.wave >= 0 ? entry.wave : 0,
    level: Number.isSafeInteger(entry.level) && entry.level >= 1 ? entry.level : 1,
  })).sort((a, b) => b.score - a.score).slice(0, MAX_SCORES);
  const topScore = scores[0]?.score ?? 0;
  const maxSavedLevel = scores.reduce((max, entry) => Math.max(max, entry.level), 1);
  const maxSavedWave = scores.reduce((max, entry) => Math.max(max, entry.wave), 0);
  return {
    version: 1,
    playerName: typeof data.playerName === "string" ? data.playerName.trim().slice(0, 20) : "",
    highestLevel: Number.isSafeInteger(data.highestLevel) && data.highestLevel >= 1
      ? Math.max(data.highestLevel, maxSavedLevel)
      : maxSavedLevel,
    highestWave: Number.isSafeInteger(data.highestWave) && data.highestWave >= 0
      ? Math.max(data.highestWave, maxSavedWave)
      : maxSavedWave,
    highScore: Number.isSafeInteger(data.highScore) && data.highScore >= 0
      ? Math.max(data.highScore, topScore)
      : topScore,
    updatedAt: Number.isSafeInteger(data.updatedAt) && data.updatedAt >= 0 ? data.updatedAt : 0,
    scores,
  };
}

function buildSavePayload() {
  highestLevelReached = Math.max(highestLevelReached, game.level || 1);
  highestWaveReached = Math.max(highestWaveReached, game.wave || 0);
  highScore = Math.max(highScore, leaderboard[0]?.score ?? 0, game.state !== "start" ? game.score : 0);
  return {
    version: 1,
    highestLevel: highestLevelReached,
    highestWave: highestWaveReached,
    highScore,
    updatedAt: Date.now(),
    scores: platform.inPlayables
      ? leaderboard.map(({ score, wave, level }) => ({ score, wave, level }))
      : leaderboard,
    ...(platform.inPlayables ? {} : { playerName }),
  };
}

async function persistProfile() {
  if (!persistenceReady || (!playerName && leaderboard.length === 0)) return false;
  const payload = buildSavePayload();
  if (!platform.inPlayables) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      return true;
    } catch (error) {
      console.error("Could not save local leaderboard.", error);
      return false;
    }
  }

  try {
    await platform.save(payload);
    return true;
  } catch (error) {
    console.error("Failed to save data to YouTube profile:", error);
    return false;
  }
}

function readLocalSave() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return normalizeSave(null);
  return normalizeSave(JSON.parse(raw));
}

function showLeaderboard() {
  leaderboardReturnPanel = [startPanel, gameoverPanel, pausePanel].find((panel) => !panel.hidden) ?? startPanel;
  leaderboardReturnPanel.hidden = true;
  leaderboardPanel.hidden = false;
  renderLeaderboard();
  updateUtilityControlVisibility();
  document.querySelector("#close-leaderboard").focus();
}

function closeLeaderboard() {
  leaderboardPanel.hidden = true;
  leaderboardReturnPanel.hidden = false;
  updateUtilityControlVisibility();
  const focusTarget = leaderboardReturnPanel === startPanel
    ? playerNameInput
    : leaderboardReturnPanel === pausePanel
      ? document.querySelector("#resume-button")
      : document.querySelector("#restart-button");
  focusTarget.focus();
}

document.querySelector("#show-leaderboard").addEventListener("click", showLeaderboard);
document.querySelectorAll(".show-leaderboard").forEach((button) => button.addEventListener("click", showLeaderboard));
document.querySelector("#close-leaderboard").addEventListener("click", closeLeaderboard);

window.addEventListener("keydown", (event) => {
  if (event.code !== "KeyM" || event.repeat || game.state === "gameover" || !audio.context) return;
  toggleMusic();
});

function frame(now) {
  if (paused) return;

  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  game.update(dt, input.snapshot());
  for (const sound of game.soundEvents.splice(0)) audio.play(sound);
  renderer.draw();

  if (game.lifeBubbleSpawns > announcedLifeBubbleSpawns) {
    announcedLifeBubbleSpawns = game.lifeBubbleSpawns;
    status.textContent = "A pink life bubble appeared. Shoot it to gain one extra life.";
  }

  if (game.lifeBubbleAwards > announcedLifeAwards) {
    announcedLifeAwards = game.lifeBubbleAwards;
    status.textContent = game.lifeNotice === "LIFE +1"
      ? `Life pickup. Lives increased to ${game.lives}.`
      : "Life pickup at maximum lives; bonus score awarded.";
  }

  if (game.level > announcedLevel) {
    announcedLevel = game.level;
    status.textContent = `Level ${game.level}. ${game.levelNotice}. Enemies move faster and attack more.`;
  }

  if (game.state === "gameover" && !gameoverAnnounced) {
    gameoverAnnounced = true;
    audio.stopMusic();
    updateUtilityControlVisibility();
    finalScore.textContent = `Pilot: ${playerName}\nFinal score: ${game.score}\nWaves reached: ${game.wave}`;
    gameoverPanel.hidden = false;
    document.querySelector("#restart-button").focus();
    status.textContent = `Game over, ${playerName}. Final score ${game.score}.`;
    void recordScore();
  }
  scheduleFrame();
}

function scheduleFrame() {
  if (frameScheduled) return;
  frameScheduled = true;
  animationFrameId = requestAnimationFrame((now) => {
    animationFrameId = null;
    frameScheduled = false;
    frame(now);
  });
}

const platform = new PlayablesBridge({
  onPause: () => {
    systemPaused = true;
    updatePauseState();
    void persistProfile();
  },
  onResume: () => {
    systemPaused = false;
    updatePauseState();
  },
  onAudioEnabledChange: (enabled) => {
    audio.setSystemEnabled(enabled);
  },
});

renderer.draw();
platform.notifyFirstFrame();
void initializePersistence();

async function initializePersistence() {
  if (platform.inPlayables) {
    pilotNameEntry.hidden = true;
    playerNameInput.required = false;
  }
  try {
    let saved;
    if (platform.inPlayables) {
      const raw = await platform.loadData();
      saved = normalizeSave(raw ? JSON.parse(raw) : null);
    } else {
      saved = readLocalSave();
    }
    leaderboard = saved.scores;
    if (platform.inPlayables) {
      leaderboard = leaderboard.map((entry) => ({ ...entry, name: "Pilot" }));
    }
    playerName = platform.inPlayables ? "Pilot" : saved.playerName;
    highScore = saved.highScore;
    highestLevelReached = saved.highestLevel;
    highestWaveReached = saved.highestWave;
    playerNameInput.value = platform.inPlayables ? "" : saved.playerName;
    persistenceReady = true;
    playerNameInput.disabled = false;
    document.querySelector("#start-button").disabled = false;
    document.querySelector("#start-button").textContent = "Play";
    renderLeaderboard();
    status.textContent = platform.inPlayables
      ? "Ready. Start when you are ready to play."
      : "Ready. Enter your pilot name to begin.";
  } catch (error) {
    persistenceReady = false;
    playerNameInput.disabled = false;
    document.querySelector("#start-button").disabled = false;
    document.querySelector("#start-button").textContent = "Play without leaderboard";
    status.textContent = "Could not load saved scores. You can play, but this run's score will not be saved.";
    console.error("Could not load leaderboard data.", error);
  } finally {
    platform.notifyReady();
  }
}

async function recordScore() {
  if (!playerName || !persistenceReady) return;
  highestLevelReached = Math.max(highestLevelReached, game.level);
  highestWaveReached = Math.max(highestWaveReached, game.wave);
  leaderboard.push({ name: playerName, score: game.score, wave: game.wave, level: game.level });
  leaderboard = leaderboard
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SCORES);
  renderLeaderboard();

  if (!platform.inPlayables) {
    const saved = await persistProfile();
    status.textContent = saved
      ? "Score saved to this browser's leaderboard."
      : "Could not save your score on this browser.";
    return;
  }

  const payload = buildSavePayload();
  const save = platform.save(payload);
  const submit = Number.isSafeInteger(payload.highScore)
    ? platform.submitScore(payload.highScore)
    : Promise.reject(new Error("Score must be a safe integer before submission."));
  const [saveResult, submitResult] = await Promise.allSettled([save, submit]);
  const failures = [saveResult, submitResult].filter((result) => result.status === "rejected");
  if (failures.length) {
    status.textContent = "Score recorded, but one or more Playables leaderboard updates failed.";
    for (const failure of failures) console.error("Playables score update failed.", failure.reason);
  } else {
    status.textContent = "Score saved and submitted to the Playables leaderboard.";
  }
}
