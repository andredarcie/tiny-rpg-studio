import { buildBackgroundMusicEmbedUrl, DEFAULT_BACKGROUND_MUSIC_VOLUME, normalizeBackgroundMusicVolume, normalizeBackgroundMusicVideoId } from '../infra/share/BackgroundMusicVideoId';
import { DEFAULT_MUSIC_PLUS_FADE_SECONDS, decodeMusicBytes, normalizeMusicPlusFadeDurationSeconds, parseMusicMidi, type MusicAsset, type MusicPlusMap } from './MusicPlus';

class BackgroundMusicEngine {
    private videoId: string | null = null;
    private iframe: HTMLIFrameElement | null = null;
    private youtubePaused = false;
    private volume = DEFAULT_BACKGROUND_MUSIC_VOLUME;
    private musicPlus: MusicPlusMap | undefined;
    private smoothTransition = false;
    private fadeDurationMs = DEFAULT_MUSIC_PLUS_FADE_SECONDS * 1000;
    private fadeFactor = 1;
    private transitionTimer: ReturnType<typeof setInterval> | null = null;
    private pendingKey: string | null = null;
    private roomIndex = 0;
    private activeKey: string | null = null;
    private audio: HTMLAudioElement | null = null;
    private context: AudioContext | null = null;
    private gain: GainNode | null = null;
    private timer: ReturnType<typeof setInterval> | null = null;
    private oscillators = new Set<OscillatorNode>();
    private playbackToken = 0;

    setVideoId(videoId?: string | null): void {
        const next = normalizeBackgroundMusicVideoId(videoId) ?? null;
        if (this.videoId === next) return;
        const wasPlayingYoutube = this.activeKey?.startsWith('youtube:');
        this.videoId = next;
        this.iframe?.remove(); this.iframe = null; this.youtubePaused = false;
        if (wasPlayingYoutube) { this.activeKey = null; this.play(); }
    }

    setRoomIndex(roomIndex: number): void {
        if (this.roomIndex === roomIndex) return;
        this.roomIndex = roomIndex;
        if (this.activeKey && this.activeKey !== this.sourceKey()) this.play();
    }

    play(): void {
        const key = this.sourceKey();
        if (typeof document === 'undefined') { this.stop(); return; }
        if (this.transitionTimer && key === this.pendingKey) return;
        if (key === this.activeKey && !this.transitionTimer) return;
        if (this.smoothTransition && this.activeKey) { this.transitionTo(key); return; }
        if (!key) { this.stop(); return; }
        this.stopActiveSource();
        this.startSource(key);
    }

    private startSource(key: string, fadeFactor = 1): void {
        this.fadeFactor = fadeFactor;
        this.activeKey = key;
        const asset = this.musicPlus?.[String(this.roomIndex)];
        if (!asset) { this.mountIframe(); return; }
        if (asset.format === 'midi') this.playMidi(asset, this.playbackToken);
        else this.playAudio(asset, this.playbackToken);
    }

    setVolume(volume: number): void {
        this.volume = normalizeBackgroundMusicVolume(volume, this.volume);
        this.applyVolume();
    }
    private applyVolume(): void {
        this.postVolumeCommand();
        if (this.audio) this.audio.volume = this.volume * this.fadeFactor / 100;
        if (this.gain) this.gain.gain.value = this.volume * this.fadeFactor / 100;
    }
    getVolume(): number { return this.volume; }

    stop(): void {
        this.stopActiveSource();
        this.iframe?.remove(); this.iframe = null;
        this.youtubePaused = false;
    }

    private stopActiveSource(): void {
        this.cancelTransition();
        this.playbackToken++;
        if (this.activeKey?.startsWith('youtube:') && this.iframe && !this.youtubePaused) {
            this.youtubePaused = true;
            this.postYoutubeCommand('pauseVideo', []);
        }
        this.activeKey = null;
        if (this.audio) { this.audio.pause(); this.audio.removeAttribute('src'); this.audio = null; }
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
        for (const oscillator of this.oscillators) { try { oscillator.stop(); } catch { /* already stopped */ } }
        this.oscillators.clear();
        if (this.context) { void this.context.close(); this.context = null; this.gain = null; }
        this.fadeFactor = 1;
    }

    private cancelTransition(): void {
        if (this.transitionTimer) clearInterval(this.transitionTimer);
        this.transitionTimer = null;
        this.pendingKey = null;
    }

    private transitionTo(key: string | null): void {
        this.cancelTransition();
        this.pendingKey = key;
        const outgoingFactor = this.fadeFactor;
        this.animateFade(outgoingFactor, 0, () => {
            this.stopActiveSource();
            if (!key) return;
            this.pendingKey = key;
            this.startSource(key, 0);
            this.animateFade(0, 1, () => { this.pendingKey = null; });
        });
    }

    private animateFade(from: number, to: number, done: () => void): void {
        const started = Date.now();
        this.transitionTimer = setInterval(() => {
            const progress = Math.min(1, (Date.now() - started) / this.fadeDurationMs);
            this.fadeFactor = from + (to - from) * progress;
            this.applyVolume();
            if (progress < 1) return;
            this.cancelTransition();
            done();
        }, 25);
    }

    syncFromGame(game: { backgroundMusicVideoId?: string; backgroundMusicVolume?: number; musicPlus?: MusicPlusMap; musicPlusSmoothTransition?: boolean; musicPlusFadeDurationSeconds?: number }): void {
        this.musicPlus = game.musicPlus;
        this.smoothTransition = game.musicPlusSmoothTransition === true;
        this.fadeDurationMs = normalizeMusicPlusFadeDurationSeconds(game.musicPlusFadeDurationSeconds) * 1000;
        this.setVideoId(game.backgroundMusicVideoId);
        this.setVolume(normalizeBackgroundMusicVolume(game.backgroundMusicVolume));
        if (this.activeKey && this.activeKey !== this.sourceKey()) this.play();
    }

    destroy(): void {
        this.stop(); this.videoId = null; this.musicPlus = undefined; this.smoothTransition = false;
        this.fadeDurationMs = DEFAULT_MUSIC_PLUS_FADE_SECONDS * 1000;
        this.volume = DEFAULT_BACKGROUND_MUSIC_VOLUME;
    }

    private sourceKey(): string | null {
        const asset = this.musicPlus?.[String(this.roomIndex)];
        return asset ? `${asset.format}:${asset.data}` : this.videoId ? `youtube:${this.videoId}` : null;
    }

    private playAudio(asset: MusicAsset, token: number): void {
        const audio = new Audio(`data:audio/${asset.format === 'mp3' ? 'mpeg' : 'wav'};base64,${asset.data}`);
        if (token !== this.playbackToken) return;
        audio.loop = true; audio.volume = this.volume * this.fadeFactor / 100; this.audio = audio;
        void audio.play().catch(() => { if (token === this.playbackToken) this.stop(); });
    }

    private playMidi(asset: MusicAsset, token: number): void {
        const sequence = parseMusicMidi(decodeMusicBytes(asset.data));
        const Context = Reflect.get(globalThis, 'AudioContext') as typeof AudioContext | undefined;
        if (!Context) { this.stop(); return; }
        const context = new Context();
        if (token !== this.playbackToken) { void context.close(); return; }
        this.context = context;
        const gain = context.createGain(); gain.gain.value = this.volume * this.fadeFactor / 100;
        gain.connect(context.destination); this.gain = gain;
        const start = context.currentTime + 0.05;
        let nextNote = 0, loop = 0;
        const schedule = () => {
            if (token !== this.playbackToken) return;
            const horizon = context.currentTime + 0.3;
            while (start + loop * sequence.duration + sequence.notes[nextNote].start < horizon) {
                const note = sequence.notes[nextNote];
                const when = start + loop * sequence.duration + note.start;
                const oscillator = context.createOscillator();
                const voice = context.createGain();
                oscillator.type = 'sine';
                oscillator.frequency.value = 440 * 2 ** ((note.pitch - 69) / 12);
                voice.gain.value = Math.max(0.001, note.velocity / 127 * 0.18);
                oscillator.connect(voice); voice.connect(gain);
                oscillator.onended = () => { oscillator.disconnect(); voice.disconnect(); this.oscillators.delete(oscillator); };
                this.oscillators.add(oscillator);
                oscillator.start(Math.max(context.currentTime, when));
                oscillator.stop(Math.max(context.currentTime, when) + note.duration);
                nextNote++;
                if (nextNote === sequence.notes.length) { nextNote = 0; loop++; }
            }
        };
        void context.resume().then(() => { if (token === this.playbackToken) schedule(); });
        this.timer = setInterval(schedule, 100);
    }

    private mountIframe(): void {
        if (!this.videoId || typeof document === 'undefined') return;
        const src = buildBackgroundMusicEmbedUrl(this.videoId);
        if (!src) { this.stop(); return; }
        if (!this.iframe) {
            this.iframe = document.createElement('iframe');
            this.iframe.width = '0'; this.iframe.height = '0';
            this.iframe.setAttribute('aria-hidden', 'true');
            this.iframe.setAttribute('allow', 'autoplay; encrypted-media');
            this.iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
            this.iframe.tabIndex = -1;
            this.iframe.addEventListener('load', () => {
                this.postVolumeCommand();
                if (this.youtubePaused) this.postYoutubeCommand('pauseVideo', []);
            });
            Object.assign(this.iframe.style, { position: 'fixed', width: '0', height: '0', border: '0', opacity: '0', pointerEvents: 'none' });
            document.body.appendChild(this.iframe);
        }
        if (this.iframe.src !== src) {
            this.youtubePaused = false;
            this.iframe.src = src;
        } else if (this.youtubePaused) {
            this.youtubePaused = false;
            this.postYoutubeCommand('playVideo', []);
        }
        this.postVolumeCommand();
    }

    private postVolumeCommand(): void {
        this.postYoutubeCommand('setVolume', [Math.round(this.volume * this.fadeFactor)]);
    }

    private postYoutubeCommand(func: string, args: unknown[]): void {
        const targetWindow = this.iframe?.contentWindow;
        if (!targetWindow) return;
        targetWindow.postMessage(JSON.stringify({ event: 'command', func, args }), 'https://www.youtube.com');
    }
}

export { BackgroundMusicEngine };
