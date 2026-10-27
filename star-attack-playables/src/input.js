export class InputController {
  constructor(canvas, controls) {
    this.canvas = canvas;
    this.touchPositions = new Map();
    this.firePointers = new Set();
    this.leftPointers = new Set();
    this.rightPointers = new Set();
    this.upPointers = new Set();
    this.downPointers = new Set();
    this.mouseX = null;
    this.mouseY = null;
    this.tapUntil = { left: 0, right: 0, up: 0, down: 0, fire: 0 };
    this.left = false;
    this.right = false;
    this.up = false;
    this.down = false;
    this.spaceDown = false;

    this.onPointerMove = this.onPointerMove.bind(this);
    this.onCanvasPointerDown = this.onCanvasPointerDown.bind(this);
    this.onCanvasPointerUp = this.onCanvasPointerUp.bind(this);
    this.onKeyChange = this.onKeyChange.bind(this);

    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerdown", this.onCanvasPointerDown);
    canvas.addEventListener("pointerup", this.onCanvasPointerUp);
    canvas.addEventListener("pointercancel", this.onCanvasPointerUp);
    canvas.addEventListener("lostpointercapture", this.onCanvasPointerUp);
    window.addEventListener("keydown", this.onKeyChange);
    window.addEventListener("keyup", this.onKeyChange);
    window.addEventListener("blur", () => this.reset());

    this.bindHoldControl(controls.left, this.leftPointers);
    this.bindHoldControl(controls.right, this.rightPointers);
    this.bindHoldControl(controls.up, this.upPointers);
    this.bindHoldControl(controls.down, this.downPointers);
    this.bindHoldControl(controls.fire, this.firePointers);
  }

  onPointerMove(event) {
    if (event.pointerType === "touch") {
      if (this.touchPositions.has(event.pointerId)) {
        this.touchPositions.set(event.pointerId, this.canvasPosition(event));
      }
      return;
    }
    this.mouseX = this.canvasX(event);
    this.mouseY = this.canvasY(event);
  }

  onCanvasPointerDown(event) {
    if (event.pointerType !== "touch" && event.button !== 0) return;
    this.firePointers.add(event.pointerId);
    if (event.pointerType === "touch") {
      this.touchPositions.set(event.pointerId, this.canvasPosition(event));
    } else {
      this.mouseX = this.canvasX(event);
      this.mouseY = this.canvasY(event);
    }
    this.canvas.setPointerCapture(event.pointerId);
  }

  onCanvasPointerUp(event) {
    this.firePointers.delete(event.pointerId);
    this.touchPositions.delete(event.pointerId);
    this.releaseCapture(this.canvas, event.pointerId);
  }

  bindHoldControl(button, activePointers) {
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", (event) => {
      if (event.detail !== 0) return;
      this.tapUntil[button.dataset.control] = performance.now() + 250;
    });
    button.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "touch" && event.button !== 0) return;
      event.preventDefault();
      activePointers.add(event.pointerId);
      button.setAttribute("aria-pressed", "true");
      button.setPointerCapture(event.pointerId);
    });

    const release = (event) => {
      activePointers.delete(event.pointerId);
      button.setAttribute("aria-pressed", String(activePointers.size > 0));
      this.releaseCapture(button, event.pointerId);
    };
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
  }

  onKeyChange(event) {
    const isDown = event.type === "keydown";
    if (isDown && (event.code === "ArrowLeft" || event.code === "KeyA" ||
      event.code === "ArrowRight" || event.code === "KeyD")) {
      this.mouseX = null;
    }
    if (isDown && (event.code === "ArrowUp" || event.code === "KeyW" ||
      event.code === "ArrowDown" || event.code === "KeyS")) {
      this.mouseY = null;
    }
    if (event.code === "ArrowLeft" || event.code === "KeyA") this.left = isDown;
    if (event.code === "ArrowRight" || event.code === "KeyD") this.right = isDown;
    if (event.code === "ArrowUp" || event.code === "KeyW") this.up = isDown;
    if (event.code === "ArrowDown" || event.code === "KeyS") this.down = isDown;
    if (event.code === "Space") this.spaceDown = isDown;
  }

  canvasX(event) {
    return event.clientX - this.canvas.getBoundingClientRect().left;
  }

  canvasY(event) {
    return event.clientY - this.canvas.getBoundingClientRect().top;
  }

  canvasPosition(event) {
    return { x: this.canvasX(event), y: this.canvasY(event) };
  }

  releaseCapture(element, pointerId) {
    if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
  }

  snapshot() {
    const now = performance.now();
    const left = this.left || this.leftPointers.size > 0 || now < this.tapUntil.left;
    const right = this.right || this.rightPointers.size > 0 || now < this.tapUntil.right;
    const up = this.up || this.upPointers.size > 0 || now < this.tapUntil.up;
    const down = this.down || this.downPointers.size > 0 || now < this.tapUntil.down;
    const touchPositions = [...this.touchPositions.values()];
    const touchPosition = touchPositions[touchPositions.length - 1];
    return {
      pointerX: left || right ? null : (touchPosition?.x ?? this.mouseX),
      pointerY: up || down ? null : (touchPosition?.y ?? this.mouseY),
      left,
      right,
      up,
      down,
      fire: this.spaceDown || this.firePointers.size > 0 || now < this.tapUntil.fire,
    };
  }

  reset() {
    this.touchPositions.clear();
    this.firePointers.clear();
    this.leftPointers.clear();
    this.rightPointers.clear();
    this.upPointers.clear();
    this.downPointers.clear();
    this.mouseX = null;
    this.mouseY = null;
    for (const button of this.canvas.parentElement.querySelectorAll(".touch-button")) {
      button.setAttribute("aria-pressed", "false");
    }
    this.left = false;
    this.right = false;
    this.up = false;
    this.down = false;
    this.spaceDown = false;
    this.tapUntil = { left: 0, right: 0, up: 0, down: 0, fire: 0 };
  }
}
