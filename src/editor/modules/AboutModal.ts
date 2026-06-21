/**
 * AboutModal — "About" button and engine information modal.
 *
 * Opens a small modal explaining what Tiny RPG Studio is and who created it
 * (André N. Darcie and Diguifi) — an open-source, free, non-profit engine.
 *
 * Mirrors the structure of {@link DevlogModal}: a static template in index.html
 * is shown/hidden, and closes on the close button, backdrop click, or Escape.
 * The content itself is localized via `data-text-key` hydration, so this class
 * only owns the open/close behaviour.
 */
import { track } from '../../analytics/track';

class AboutModal {
  private button: HTMLButtonElement | null;
  private modal: HTMLElement | null;
  private closeBtn: HTMLButtonElement | null;

  private boundOpen = () => this.open();
  private boundClose = () => this.close();
  private boundBackdrop = (e: MouseEvent) => { if (e.target === this.modal) this.close(); };
  private boundKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.modal && !this.modal.hidden) this.close();
  };

  constructor() {
    this.button = document.getElementById('btn-about') as HTMLButtonElement | null;
    this.modal = document.getElementById('about-modal');
    this.closeBtn = document.getElementById('about-close') as HTMLButtonElement | null;
    this.bind();
  }

  private bind(): void {
    this.button?.addEventListener('click', this.boundOpen);
    this.closeBtn?.addEventListener('click', this.boundClose);
    this.modal?.addEventListener('click', this.boundBackdrop);
    document.addEventListener('keydown', this.boundKeydown);
  }

  open(): void {
    if (!this.modal) return;
    this.modal.hidden = false;
    track('about_opened');
  }

  close(): void {
    if (!this.modal) return;
    this.modal.hidden = true;
  }

  destroy(): void {
    this.button?.removeEventListener('click', this.boundOpen);
    this.closeBtn?.removeEventListener('click', this.boundClose);
    this.modal?.removeEventListener('click', this.boundBackdrop);
    document.removeEventListener('keydown', this.boundKeydown);
  }
}

export { AboutModal };
