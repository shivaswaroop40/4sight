// src/core/TimeController.ts
//
// Drives u in [0, 1]. Knows nothing about what it drives beyond the
// attached experience's TimeMapping and baseDurationSeconds. Playback,
// scrubbing, reverse, and warp all fall out of one update rule:
//
//   du/dt_real = direction * playbackSpeed / baseDurationSeconds
//
// Warp semantics: playbackSpeed w multiplies the 1x rate. A full pass takes
// baseDurationSeconds / w real seconds, and at every point of the timeline
// experience time advances exactly w times faster than it does at 1x there.
// See src/core/warp.ts for the effective rate in experience units.
//
// Boundaries: playback pauses when u reaches the end it is heading for.
// Pressing Play while parked at that end restarts the pass from the other
// end in the same direction (u = 1 going forward jumps to 0; u = 0 going in
// reverse jumps to 1). Without this, Play at an end was a silent no-op.
//
// setTime/setParam call the attached experience's setTime(time), which must
// be a pure, idempotent function of time. The controller never accumulates
// state beyond u itself.

import type { FourDExperience, TimeController as ITimeController, TimeState } from "./types";
import { defaultWarp } from "./warp";

const DEFAULT_STATE: TimeState = {
  param: 0,
  time: 0,
  isPlaying: false,
  direction: 1,
  playbackSpeed: 1,
};

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

export class TimeController implements ITimeController {
  private _state: TimeState = { ...DEFAULT_STATE };
  private experience: FourDExperience | null = null;
  private listeners = new Set<(state: TimeState) => void>();
  private scrubbing = false;

  get state(): TimeState {
    return this._state;
  }

  /** True while the user holds the timeline thumb. Playback does not advance. */
  get isScrubbing(): boolean {
    return this.scrubbing;
  }

  attach(experience: FourDExperience): void {
    this.experience = experience;
    this.scrubbing = false;
    const param = 0;
    const time = experience.mapping.toTime(param);
    this._state = {
      param,
      time,
      isPlaying: false,
      direction: 1,
      playbackSpeed: defaultWarp(experience),
    };
    experience.setTime(time);
    this.notify();
  }

  play(): void {
    if (this._state.isPlaying) return;
    const { direction, param } = this._state;
    const atEnd = direction === 1 ? param >= 1 : param <= 0;
    if (atEnd) {
      // Restart the pass instead of re-pausing on the next tick.
      const restart = direction === 1 ? 0 : 1;
      this._state = { ...this._state, isPlaying: true };
      this.applyParam(restart);
      return;
    }
    this._state = { ...this._state, isPlaying: true };
    this.notify();
  }

  pause(): void {
    if (!this._state.isPlaying) return;
    this._state = { ...this._state, isPlaying: false };
    this.notify();
  }

  toggle(): void {
    if (this._state.isPlaying) this.pause();
    else this.play();
  }

  reverse(): void {
    const direction = this._state.direction === 1 ? -1 : 1;
    this._state = { ...this._state, direction };
    this.notify();
  }

  setTime(time: number): void {
    if (!this.experience) return;
    const param = this.experience.mapping.toParam(time);
    this.applyParam(param);
  }

  setParam(u: number): void {
    if (!Number.isFinite(u)) return;
    this.applyParam(clamp01(u));
  }

  setPlaybackSpeed(speed: number): void {
    if (!Number.isFinite(speed) || speed <= 0) return;
    if (speed === this._state.playbackSpeed) return;
    this._state = { ...this._state, playbackSpeed: speed };
    this.notify();
  }

  /** Suspends playback advance while the user drags the timeline. Not part of the shared contract. */
  setScrubbing(scrubbing: boolean): void {
    this.scrubbing = scrubbing;
  }

  jumpToEvent(eventId: string): void {
    if (!this.experience) return;
    const event = this.experience.events.find((e) => e.id === eventId);
    if (!event) return;
    this.setTime(event.time);
  }

  reset(): void {
    if (!this.experience) return;
    this._state = {
      param: 0,
      time: this.experience.mapping.toTime(0),
      isPlaying: false,
      direction: 1,
      playbackSpeed: this._state.playbackSpeed,
    };
    this.experience.reset();
    this.experience.setTime(this._state.time);
    this.notify();
  }

  tick(dtSeconds: number): void {
    if (!this.experience || !this._state.isPlaying || this.scrubbing) return;
    if (!(dtSeconds > 0)) return;
    const { direction, playbackSpeed, param } = this._state;
    const du = (direction * playbackSpeed * dtSeconds) / this.experience.baseDurationSeconds;
    let nextParam = clamp01(param + du);
    // Snap float residue (0.9999999999999999) onto the end so the pass really finishes.
    if (nextParam > 1 - 1e-9) nextParam = 1;
    if (nextParam < 1e-9) nextParam = 0;
    const hitBoundary = direction === 1 ? nextParam >= 1 : nextParam <= 0;
    if (hitBoundary) {
      this._state = { ...this._state, isPlaying: false };
    }
    this.applyParam(nextParam);
  }

  subscribe(listener: (state: TimeState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private applyParam(param: number): void {
    if (!this.experience) return;
    const time = this.experience.mapping.toTime(param);
    this._state = { ...this._state, param, time };
    this.experience.setTime(time);
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this._state);
    }
  }
}
