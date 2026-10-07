import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BackgroundMusicEngine } from '../../runtime/services/BackgroundMusicEngine';

describe('BackgroundMusicEngine', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('creates a hidden looping YouTube iframe when playback starts', () => {
    const engine = new BackgroundMusicEngine();

    engine.setVideoId('t0ihNLLZNi0');
    engine.play();

    const iframe = document.querySelector('iframe[src*="youtube.com/embed/t0ihNLLZNi0"]');
    expect(iframe).toBeInstanceOf(HTMLIFrameElement);
    expect(iframe?.getAttribute('src')).toContain('playlist=t0ihNLLZNi0');
    expect(iframe?.getAttribute('src')).toContain('loop=1');
    expect(iframe?.getAttribute('src')).toContain('enablejsapi=1');
  });

  it('removes playback when the configured video id is cleared', () => {
    const engine = new BackgroundMusicEngine();

    engine.setVideoId('t0ihNLLZNi0');
    engine.play();
    expect(document.querySelector('iframe[src*="youtube.com/embed/t0ihNLLZNi0"]')).toBeInstanceOf(HTMLIFrameElement);
    engine.setVideoId('');

    expect(document.querySelector('iframe[src*="youtube.com/embed/t0ihNLLZNi0"]')).toBeNull();
  });

  it('syncs from game data and destroys the iframe on teardown', () => {
    const engine = new BackgroundMusicEngine();

    engine.syncFromGame({ backgroundMusicVideoId: 't0ihNLLZNi0' });
    engine.play();
    expect(document.querySelector('iframe[src*="youtube.com/embed/t0ihNLLZNi0"]')).toBeInstanceOf(HTMLIFrameElement);
    engine.destroy();

    expect(document.querySelector('iframe[src*="youtube.com/embed/t0ihNLLZNi0"]')).toBeNull();
  });

  it('syncs and applies volume from game data', () => {
    const engine = new BackgroundMusicEngine();

    engine.syncFromGame({ backgroundMusicVideoId: 't0ihNLLZNi0', backgroundMusicVolume: 37 });
    engine.play();

    const iframe = document.querySelector('iframe[src*="youtube.com/embed/t0ihNLLZNi0"]') as HTMLIFrameElement;
    const postMessage = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: { postMessage },
    });
    iframe.dispatchEvent(new Event('load'));

    expect(engine.getVolume()).toBe(37);
    expect(postMessage).toHaveBeenCalledWith(
      JSON.stringify({ event: 'command', func: 'setVolume', args: [37] }),
      'https://www.youtube.com',
    );
  });

  it('setVolume posts a YouTube setVolume command to an existing iframe', () => {
    const engine = new BackgroundMusicEngine();

    engine.setVideoId('t0ihNLLZNi0');
    engine.play();
    const iframe = document.querySelector('iframe[src*="youtube.com/embed/t0ihNLLZNi0"]') as HTMLIFrameElement;
    const postMessage = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: { postMessage },
    });

    engine.setVolume(42.8);

    expect(engine.getVolume()).toBe(42);
    expect(postMessage).toHaveBeenCalledWith(
      JSON.stringify({ event: 'command', func: 'setVolume', args: [42] }),
      'https://www.youtube.com',
    );
  });

  it('applies volume set before play when the iframe loads', () => {
    const engine = new BackgroundMusicEngine();

    engine.setVideoId('t0ihNLLZNi0');
    engine.setVolume(25);
    engine.play();

    const iframe = document.querySelector('iframe[src*="youtube.com/embed/t0ihNLLZNi0"]') as HTMLIFrameElement;
    const postMessage = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: { postMessage },
    });
    iframe.dispatchEvent(new Event('load'));

    expect(postMessage).toHaveBeenCalledWith(
      JSON.stringify({ event: 'command', func: 'setVolume', args: [25] }),
      'https://www.youtube.com',
    );
  });

  it('keeps local volume usable after the video id is cleared', () => {
    const engine = new BackgroundMusicEngine();

    engine.syncFromGame({ backgroundMusicVideoId: 't0ihNLLZNi0', backgroundMusicVolume: 65 });
    engine.play();
    engine.syncFromGame({ backgroundMusicVideoId: '', backgroundMusicVolume: 65 });
    engine.setVolume(12);

    expect(document.querySelector('iframe[src*="youtube.com/embed/t0ihNLLZNi0"]')).toBeNull();
    expect(engine.getVolume()).toBe(12);
  });

  it('does not restart playback when play is called again with the same video id', () => {
    const engine = new BackgroundMusicEngine();

    engine.setVideoId('t0ihNLLZNi0');
    engine.play();

    const iframe = document.querySelector('iframe[src*="youtube.com/embed/t0ihNLLZNi0"]') as HTMLIFrameElement | null;
    const firstSrc = iframe?.getAttribute('src');

    engine.play();

    const iframeAfterSecondPlay = document.querySelector('iframe[src*="youtube.com/embed/t0ihNLLZNi0"]') as HTMLIFrameElement | null;
    expect(iframeAfterSecondPlay).toBe(iframe);
    expect(iframeAfterSecondPlay?.getAttribute('src')).toBe(firstSrc);
  });

  it('pauses the retained YouTube player for room audio and resumes it without reloading', () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const engine = new BackgroundMusicEngine();
    engine.syncFromGame({ backgroundMusicVideoId: 't0ihNLLZNi0', musicPlus: { '1': { format: 'mp3', data: 'AAAA' } } });
    engine.play();
    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    const src = iframe.getAttribute('src');
    const postMessage = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', { configurable: true, value: { postMessage } });
    engine.setRoomIndex(1);
    expect(document.querySelector('iframe')).toBe(iframe);
    expect(postMessage).toHaveBeenCalledWith(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), 'https://www.youtube.com');
    iframe.dispatchEvent(new Event('load'));
    expect(postMessage.mock.calls.filter(([payload]) => (JSON.parse(payload as string) as { func: string }).func === 'pauseVideo')).toHaveLength(2);
    expect(play).toHaveBeenCalledTimes(1);
    engine.setVolume(25);
    engine.play();
    expect(play).toHaveBeenCalledTimes(1);
    engine.setRoomIndex(0);
    expect(pause).toHaveBeenCalled();
    expect(document.querySelector('iframe')).toBe(iframe);
    expect(iframe.getAttribute('src')).toBe(src);
    expect(postMessage).toHaveBeenCalledWith(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), 'https://www.youtube.com');
    engine.destroy();
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('clears a paused YouTube player on reset and uses the new video after a URL change', () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const engine = new BackgroundMusicEngine();
    engine.syncFromGame({ backgroundMusicVideoId: 't0ihNLLZNi0', musicPlus: { '1': { format: 'mp3', data: 'AAAA' } } });
    engine.play();
    engine.setRoomIndex(1);
    const oldIframe = document.querySelector('iframe');
    engine.setVideoId('M7lc1UVf-VE');
    expect(oldIframe?.isConnected).toBe(false);
    engine.setRoomIndex(0);
    expect(document.querySelector('iframe[src*="M7lc1UVf-VE"]')).not.toBeNull();
    engine.setRoomIndex(1);
    engine.stop();
    expect(document.querySelector('iframe')).toBeNull();
    engine.destroy();
  });

  it('ignores an obsolete audio play rejection after switching rooms', async () => {
    let rejectPlay: (error: Error) => void = () => {};
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => new Promise<void>((_resolve, reject) => { rejectPlay = reject; }));
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const engine = new BackgroundMusicEngine();
    engine.syncFromGame({ backgroundMusicVideoId: 't0ihNLLZNi0', musicPlus: { '1': { format: 'mp3', data: 'AAAA' } } });
    engine.setRoomIndex(1);
    engine.play();
    engine.setRoomIndex(0);
    rejectPlay(Error('obsolete'));
    await Promise.resolve();
    expect(document.querySelector('iframe')).not.toBeNull();
    engine.destroy();
  });

  it('fades out room audio before fading in the next track and cancels a fade on stop', () => {
    vi.useFakeTimers();
    const played: HTMLMediaElement[] = [];
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) { played.push(this); return Promise.resolve(); });
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    pause.mockClear();
    const engine = new BackgroundMusicEngine();
    try {
      engine.syncFromGame({ backgroundMusicVolume: 80, musicPlusSmoothTransition: true, musicPlusFadeDurationSeconds: 0.3, musicPlus: {
        '0': { format: 'mp3', data: 'AAAA' }, '1': { format: 'mp3', data: 'BBBB' },
      } });
      engine.play();
      expect(played[0].volume).toBeCloseTo(0.8);
      engine.setRoomIndex(1);
      vi.advanceTimersByTime(150);
      expect(played[0].volume).toBeCloseTo(0.4);
      expect(played).toHaveLength(1);
      vi.advanceTimersByTime(150);
      expect(pause).toHaveBeenCalledTimes(1);
      expect(played).toHaveLength(2);
      expect(played[1].volume).toBe(0);
      vi.advanceTimersByTime(150);
      expect(played[1].volume).toBeCloseTo(0.4);
      engine.stop();
      vi.advanceTimersByTime(300);
      expect(played).toHaveLength(2);
      expect(pause).toHaveBeenCalledTimes(2);
    } finally { engine.destroy(); vi.useRealTimers(); }
  });

  it('fades the YouTube fallback down before pausing it for room audio', () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const engine = new BackgroundMusicEngine();
    try {
      engine.syncFromGame({ backgroundMusicVideoId: 't0ihNLLZNi0', musicPlusSmoothTransition: true, musicPlusFadeDurationSeconds: 0.3,
        musicPlus: { '1': { format: 'mp3', data: 'AAAA' } } });
      engine.play();
      const iframe = document.querySelector('iframe') as HTMLIFrameElement;
      const postMessage = vi.fn();
      Object.defineProperty(iframe, 'contentWindow', { configurable: true, value: { postMessage } });
      engine.setRoomIndex(1);
      vi.advanceTimersByTime(150);
      expect(postMessage).toHaveBeenCalledWith(JSON.stringify({ event: 'command', func: 'setVolume', args: [50] }), 'https://www.youtube.com');
      expect(postMessage.mock.calls.some(([payload]) => (JSON.parse(payload as string) as { func: string }).func === 'pauseVideo')).toBe(false);
      vi.advanceTimersByTime(150);
      expect(postMessage).toHaveBeenCalledWith(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), 'https://www.youtube.com');
      engine.setRoomIndex(0);
      vi.advanceTimersByTime(300);
      expect(postMessage).toHaveBeenCalledWith(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), 'https://www.youtube.com');
      vi.advanceTimersByTime(300);
      expect(postMessage).toHaveBeenCalledWith(JSON.stringify({ event: 'command', func: 'setVolume', args: [100] }), 'https://www.youtube.com');
    } finally { engine.destroy(); vi.useRealTimers(); }
  });

  it('uses the saved duration for each fade instead of the former fixed interval', () => {
    vi.useFakeTimers();
    const played: HTMLMediaElement[] = [];
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) { played.push(this); return Promise.resolve(); });
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const engine = new BackgroundMusicEngine();
    try {
      engine.syncFromGame({ musicPlusSmoothTransition: true, musicPlusFadeDurationSeconds: 1.2, musicPlus: {
        '0': { format: 'mp3', data: 'AAAA' }, '1': { format: 'mp3', data: 'BBBB' },
      } });
      engine.play();
      engine.setRoomIndex(1);
      vi.advanceTimersByTime(600);
      expect(played).toHaveLength(1);
      expect(played[0].volume).toBeCloseTo(0.5);
      vi.advanceTimersByTime(600);
      expect(played).toHaveLength(2);
      expect(played[1].volume).toBe(0);
      vi.advanceTimersByTime(600);
      expect(played[1].volume).toBeCloseTo(0.5);
      vi.advanceTimersByTime(600);
      expect(played[1].volume).toBe(1);
    } finally { engine.destroy(); vi.useRealTimers(); }
  });
});
