// src/core/TimeController.ts
//
// Drives u in [0, 1]. Knows nothing about what it drives beyond the
// attached experience's TimeMapping and baseDurationSeconds. Playback,
// scrubbing, reverse, and warp all fall out of one update rule:
//
//   du/dt_real = direction * playbackSpeed / baseDurationSeconds
//
// setTime/setParam call the attached experience's setTime(time), which must
// be a pure, idempotent function of time. The controller never accumulates
// state beyond u itself.

import type { FourDExperience, TimeController as ITimeController, TimeState } from "./types";

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

  get state(): TimeState {
    return this._state;
  }

  attach(experience: FourDExperience): void {
    this.experience = experience;
    const param = 0;
    const time = experience.mapping.toTime(param);
    this._state = {
      param,
      time,
      isPlaying: false,
      direction: 1,
      playbackSpeed: 1,
    };
    experience.setTime(time);
    this.notify();
  }

  play(): void {
    if (this._state.isPlaying) return;
    this._state = { ...this._state, isPlaying: true };
    this.notify();
  }

  pause(): void {
    if (!this._state.isPlaying) return;
    this._state = { ...this._state, isPlaying: false };
    this.notify();
  }

  toggle(): void {
    this._state.isPlaying ? this.pause() : this.play();
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
    this.applyParam(clamp01(u));
  }

  setPlaybackSpeed(speed: number): void {
    this._state = { ...this._state, playbackSpeed: speed };
    this.notify();
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
    if (!this.experience || !this._state.isPlaying) return;
    const { direction, playbackSpeed } = this._state;
    const du = (direction * playbackSpeed * dtSeconds) / this.experience.baseDurationSeconds;
    const nextParam = clamp01(this._state.param + du);
    const hitBoundary = nextParam === 0 || nextParam === 1;
    this.applyParam(nextParam);
    if (hitBoundary) {
      this.pause();
    }
  }

  subscribe(listener: (state: TimeState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
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
