/**
 * AboutModal — "About" button and engine information modal.
 *
 * Opens a small modal explaining what Tiny RPG Studio is and who created it
 * (André N. Darcie and Diguifi) — an open-source, free, non-profit engine.
 *
 * The shell (scrim, panel, header, close button, Escape and backdrop handling)
 * comes from {@link Modal}; the content is a static template in index.html
 * localized via `data-text-key` hydration. This class only owns the button and
 * the analytics event.
 */
import { track } from '../../analytics/track';
import { Modal } from '../../ui/Modal';

class AboutModal {
  private button: HTMLButtonElement | null;
  private modal: Modal | null;

  private boundOpen = () => this.open();

  constructor() {
    this.button = document.getElementById('btn-about') as HTMLButtonElement | null;
    const root = document.getElementById('about-modal');
    this.modal = root ? new Modal({ root, labelledBy: 'about-modal-title' }) : null;
    this.button?.addEventListener('click', this.boundOpen);
  }

  open(): void {
    if (!this.modal) return;
    this.modal.open();
    track('about_opened');
  }

  close(): void {
    this.modal?.close();
  }

  destroy(): void {
    this.button?.removeEventListener('click', this.boundOpen);
    this.modal?.destroy();
  }
}

export { AboutModal };
