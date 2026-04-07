/**
 * CSS styles for the trust ring overlay, injected into a closed Shadow DOM.
 */
export const RING_STYLES = `
  :host {
    position: absolute;
    pointer-events: none;
    z-index: 9999;
    display: block;
  }

  .ring {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    box-sizing: border-box;
    pointer-events: none;
    transition: border-color 0.4s ease, opacity 0.4s ease, box-shadow 0.4s ease;
  }

  .ring--initializing {
    border: 2px dashed #9ca3af;
    opacity: 0.5;
  }

  .ring--confident {
    border: 3px solid #22c55e;
    opacity: 1;
  }

  .ring--uncertain {
    border: 3px solid #f59e0b;
    opacity: 1;
    animation: pulse 1.8s ease-in-out infinite;
  }

  .ring--suspicious {
    border: 3px solid #f97316;
    opacity: 1;
  }

  .ring--likely_synthetic {
    border: 3px solid #ef4444;
    opacity: 1;
    animation: shake 0.3s ease-in-out 3;
  }

  .ring--verified {
    border: 3px solid #3b82f6;
    opacity: 1;
    position: relative;
  }

  .ring--verified::after {
    content: '';
    position: absolute;
    bottom: 4px;
    right: 4px;
    width: 20px;
    height: 20px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%233b82f6'%3E%3Cpath d='M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z'/%3E%3C/svg%3E");
    background-size: contain;
    background-repeat: no-repeat;
    pointer-events: none;
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1.0); }
    50% { transform: scale(1.03); }
  }

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-3px); }
    75% { transform: translateX(3px); }
  }
`;
