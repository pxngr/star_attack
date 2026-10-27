export class InputController {
  constructor(canvas) {
    this.canvas = canvas;
    this.touchPositions = new Map();
    this.firePointers = new Set();
    this.mouseX = null;
    this.mouseY = null;
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
    const touchPositions = [...this.touchPositions.values()];
    const touchPosition = touchPositions[touchPositions.length - 1];
    return {
      pointerX: this.left || this.right ? null : (touchPosition?.x ?? this.mouseX),
      pointerY: this.up || this.down ? null : (touchPosition?.y ?? this.mouseY),
      left: this.left,
      right: this.right,
      up: this.up,
      down: this.down,
      fire: this.spaceDown || this.firePointers.size > 0,
    };
  }

  reset() {
    this.touchPositions.clear();
    this.firePointers.clear();
    this.mouseX = null;
    this.mouseY = null;
    this.left = false;
    this.right = false;
    this.up = false;
    this.down = false;
    this.spaceDown = false;
  }
}
