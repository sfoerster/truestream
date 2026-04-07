import { TrustLevel } from '../types/trust';
import { RING_STYLES } from './ring-styles';

/**
 * TrustRingOverlay renders a colored ring around a video element
 * using a closed Shadow DOM for isolation from the host page.
 */
export class TrustRingOverlay {
  private hostElement: HTMLDivElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private ringElement: HTMLDivElement | null = null;
  private targetVideo: HTMLVideoElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private currentLevel: TrustLevel = 'initializing';

  /** Attach the trust ring overlay to a video element */
  attach(videoElement: HTMLVideoElement): void {
    this.detach();
    this.targetVideo = videoElement;

    this.hostElement = document.createElement('div');
    this.hostElement.setAttribute('data-truestream-ring', 'true');
    this.hostElement.style.position = 'absolute';
    this.hostElement.style.pointerEvents = 'none';
    this.hostElement.style.zIndex = '9999';

    this.shadowRoot = this.hostElement.attachShadow({ mode: 'closed' });

    const styleEl = document.createElement('style');
    styleEl.textContent = RING_STYLES;
    this.shadowRoot.appendChild(styleEl);

    this.ringElement = document.createElement('div');
    this.ringElement.className = `ring ring--${this.currentLevel}`;
    this.shadowRoot.appendChild(this.ringElement);

    const parent = videoElement.parentElement;
    if (parent) {
      if (getComputedStyle(parent).position === 'static') {
        parent.style.position = 'relative';
      }
      parent.appendChild(this.hostElement);
    } else {
      document.body.appendChild(this.hostElement);
    }

    this.updatePosition();

    this.resizeObserver = new ResizeObserver(() => this.updatePosition());
    this.resizeObserver.observe(videoElement);

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (this.hostElement) {
            this.hostElement.style.display = entry.isIntersecting ? 'block' : 'none';
          }
        }
      },
      { threshold: 0.1 },
    );
    this.intersectionObserver.observe(videoElement);
  }

  /** Update the displayed trust level */
  updateLevel(level: TrustLevel): void {
    this.currentLevel = level;
    if (this.ringElement) {
      this.ringElement.className = `ring ring--${level}`;
    }
  }

  /** Remove the overlay and clean up observers */
  detach(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = null;
    if (this.hostElement?.parentElement) {
      this.hostElement.parentElement.removeChild(this.hostElement);
    }
    this.hostElement = null;
    this.shadowRoot = null;
    this.ringElement = null;
    this.targetVideo = null;
  }

  private updatePosition(): void {
    if (!this.targetVideo || !this.hostElement) return;
    const rect = this.targetVideo.getBoundingClientRect();
    const parentRect = this.hostElement.parentElement?.getBoundingClientRect();
    if (parentRect) {
      this.hostElement.style.top = `${rect.top - parentRect.top}px`;
      this.hostElement.style.left = `${rect.left - parentRect.left}px`;
    } else {
      this.hostElement.style.top = `${rect.top + window.scrollY}px`;
      this.hostElement.style.left = `${rect.left + window.scrollX}px`;
    }
    this.hostElement.style.width = `${rect.width}px`;
    this.hostElement.style.height = `${rect.height}px`;
  }
}
