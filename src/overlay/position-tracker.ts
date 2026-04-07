/**
 * Tracks an element's position using requestAnimationFrame and invokes
 * a callback when it moves.
 */
export class PositionTracker {
  private element: HTMLElement | null = null;
  private callback: ((rect: DOMRect) => void) | null = null;
  private animationFrameId: number | null = null;
  private lastRect: DOMRect | null = null;

  /** Start tracking an element's position */
  start(element: HTMLElement, callback: (rect: DOMRect) => void): void {
    this.stop();
    this.element = element;
    this.callback = callback;
    this.tick();
  }

  /** Stop tracking */
  stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.element = null;
    this.callback = null;
    this.lastRect = null;
  }

  private tick(): void {
    if (!this.element || !this.callback) return;
    const rect = this.element.getBoundingClientRect();
    if (!this.lastRect || !rectsEqual(this.lastRect, rect)) {
      this.lastRect = rect;
      this.callback(rect);
    }
    this.animationFrameId = requestAnimationFrame(() => this.tick());
  }
}

function rectsEqual(a: DOMRect, b: DOMRect): boolean {
  return (
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}
