export class PlayablesBridge {
  constructor({ onPause, onResume, onAudioEnabledChange }) {
    this.sdk = window.ytgame;
    this.inPlayables = Boolean(this.sdk?.IN_PLAYABLES_ENV);
    if (!this.inPlayables) {
      onAudioEnabledChange(true);
      return;
    }

    const gameApi = this.sdk.game;
    if (!gameApi) throw new Error("YouTube Playables SDK game API is unavailable.");
    const systemApi = this.sdk.system;
    if (!systemApi) throw new Error("YouTube Playables SDK system API is unavailable.");
    this.registerCallback(systemApi, "onPause", onPause);
    this.registerCallback(systemApi, "onResume", onResume);
    onAudioEnabledChange(this.requireFunction(systemApi, "isAudioEnabled")());
    this.registerCallback(systemApi, "onAudioEnabledChange", onAudioEnabledChange);
    this.engagementApi = this.sdk.engagement;
    this.firstFrameReady = this.requireFunction(gameApi, "firstFrameReady");
    this.gameReady = this.requireFunction(gameApi, "gameReady");
    this.loadSavedData = this.requireFunction(gameApi, "loadData");
    this.saveData = this.requireFunction(gameApi, "saveData");
    this.firstFrameNotified = false;
    this.readyNotified = false;
  }

  async loadData() {
    if (!this.inPlayables) return null;
    return this.loadSavedData();
  }

  notifyFirstFrame() {
    if (!this.inPlayables || this.firstFrameNotified) return;
    this.firstFrameReady();
    this.firstFrameNotified = true;
  }

  async save(data) {
    if (!this.inPlayables) return;
    await this.saveData(JSON.stringify(data));
  }

  async submitScore(score) {
    if (!this.inPlayables) return;
    if (typeof this.engagementApi?.sendScore !== "function") {
      throw new Error("YouTube Playables SDK is missing engagement.sendScore().");
    }
    await this.engagementApi.sendScore({ value: score });
  }

  notifyReady() {
    if (!this.inPlayables || this.readyNotified) return;
    this.notifyFirstFrame();
    this.gameReady();
    this.readyNotified = true;
  }

  requireFunction(target, name) {
    if (typeof target[name] !== "function") {
      throw new Error(`YouTube Playables SDK is missing game.${name}().`);
    }
    return target[name].bind(target);
  }

  registerCallback(target, name, callback) {
    if (typeof target[name] !== "function") {
      throw new Error(`YouTube Playables SDK is missing system.${name}().`);
    }
    target[name](callback);
  }
}
