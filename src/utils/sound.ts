// Browser-native Web Audio alert sound synthesizer for emergency hospital operations

class SoundManager {
  private audioCtx: AudioContext | null = null;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {
        // User gesture may be required on some browsers
      });
    }

    return this.audioCtx;
  }

  /**
   * Plays a professional emergency hospital command center alert pulse (two-tone chime/siren pattern)
   */
  public playSurgeAlertSound() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Pulse 1: 880 Hz (A5 - High warning tone)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.exponentialRampToValueAtTime(740, now + 0.18);

      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.linearRampToValueAtTime(0.25, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.25);

      // Pulse 2: 988 Hz (B5 - Escalation tone after 140ms pause)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(988, now + 0.18);
      osc2.frequency.exponentialRampToValueAtTime(880, now + 0.38);

      gain2.gain.setValueAtTime(0.001, now + 0.18);
      gain2.gain.linearRampToValueAtTime(0.28, now + 0.2);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc2.start(now + 0.18);
      osc2.stop(now + 0.48);

      // Pulse 3: 1175 Hz (D6 - Final urgency chime)
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(1175, now + 0.42);
      osc3.frequency.exponentialRampToValueAtTime(1046, now + 0.65);

      gain3.gain.setValueAtTime(0.001, now + 0.42);
      gain3.gain.linearRampToValueAtTime(0.2, now + 0.44);
      gain3.gain.exponentialRampToValueAtTime(0.0001, now + 0.72);

      osc3.connect(gain3);
      gain3.connect(ctx.destination);

      osc3.start(now + 0.42);
      osc3.stop(now + 0.75);
    } catch (e) {
      // Audio autoplay policy or device audio unavailable; fail gracefully
      console.warn('Alert audio could not play:', e);
    }
  }

  /**
   * Short audible click for toggling alert volume
   */
  public playToggleBlip(isMuted: boolean) {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(isMuted ? 440 : 660, now);
      osc.frequency.exponentialRampToValueAtTime(isMuted ? 330 : 880, now + 0.08);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.09);
    } catch {
      // Ignore
    }
  }
}

export const soundManager = new SoundManager();
