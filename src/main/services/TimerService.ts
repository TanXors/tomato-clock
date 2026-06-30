import { EventEmitter } from 'node:events';
import {
  DEFAULT_TIMER_SETTINGS,
  type TimerPhase,
  type TimerSettings,
  type TimerSnapshot,
  type TimerStatus
} from '../../shared/types';

interface TimerRuntimeState {
  phase: TimerPhase;
  status: TimerStatus;
  settings: TimerSettings;
  startedAt: number | null;
  phaseStartedAt: number | null;
  expectedPhaseEndAt: number | null;
  pausedAt: number | null;
  lastRemainingSeconds: number;
}

type TimerEvent = 'state-changed' | 'focus-completed' | 'session-completed';

const TICK_INTERVAL_MS = 500;
const MINUTES_TO_MS = 60 * 1000;

export class TimerService {
  private readonly events = new EventEmitter();

  private tickTimer: NodeJS.Timeout | null = null;

  private state: TimerRuntimeState = this.createIdleState(DEFAULT_TIMER_SETTINGS);

  constructor(private readonly now: () => number = () => Date.now()) {}

  start(settings: TimerSettings): TimerSnapshot {
    const normalizedSettings = this.normalizeSettings(settings);
    const now = this.now();

    this.state = {
      phase: 'focus',
      status: 'running',
      settings: normalizedSettings,
      startedAt: now,
      phaseStartedAt: now,
      expectedPhaseEndAt: now + normalizedSettings.focusMinutes * MINUTES_TO_MS,
      pausedAt: null,
      lastRemainingSeconds: normalizedSettings.focusMinutes * 60
    };

    this.ensureTicking();
    return this.emitStateChanged();
  }

  pause(): TimerSnapshot {
    if (this.state.status !== 'running') {
      return this.getSnapshot();
    }

    this.state = {
      ...this.state,
      status: 'paused',
      pausedAt: this.now(),
      lastRemainingSeconds: this.getRemainingSeconds()
    };

    this.clearTicking();
    return this.emitStateChanged();
  }

  resume(): TimerSnapshot {
    if (this.state.status !== 'paused') {
      return this.getSnapshot();
    }

    const now = this.now();
    this.state = {
      ...this.state,
      status: 'running',
      expectedPhaseEndAt: now + this.state.lastRemainingSeconds * 1000,
      pausedAt: null
    };

    this.ensureTicking();
    return this.emitStateChanged();
  }

  restart(): TimerSnapshot {
    if (this.state.phase === 'idle') {
      return this.getSnapshot();
    }

    return this.start(this.state.settings);
  }

  resetToIdle(settings = DEFAULT_TIMER_SETTINGS): TimerSnapshot {
    this.clearTicking();
    this.state = this.createIdleState(settings);
    return this.emitStateChanged();
  }

  getSnapshot(): TimerSnapshot {
    const remainingSeconds = this.getRemainingSeconds();
    const totalSeconds = this.getTotalSeconds();
    const progress =
      totalSeconds === 0 ? 0 : Math.min(1, Math.max(0, (totalSeconds - remainingSeconds) / totalSeconds));

    return {
      phase: this.state.phase,
      status: this.state.status,
      settings: this.state.settings,
      startedAt: this.state.startedAt,
      phaseStartedAt: this.state.phaseStartedAt,
      expectedPhaseEndAt: this.state.expectedPhaseEndAt,
      pausedAt: this.state.pausedAt,
      remainingSeconds,
      totalSeconds,
      progress
    };
  }

  on(event: 'state-changed', listener: (snapshot: TimerSnapshot) => void): () => void;
  on(event: 'focus-completed', listener: () => void): () => void;
  on(event: 'session-completed', listener: () => void): () => void;
  on(event: TimerEvent, listener: ((snapshot: TimerSnapshot) => void) | (() => void)): () => void {
    this.events.on(event, listener);
    return () => this.events.off(event, listener);
  }

  dispose(): void {
    this.clearTicking();
    this.events.removeAllListeners();
  }

  private tick(): void {
    if (this.state.status !== 'running') {
      return;
    }

    if (this.getRemainingSeconds() > 0) {
      return;
    }

    if (this.state.phase === 'focus') {
      this.completeFocusPhase();
      return;
    }

    if (this.state.phase === 'break') {
      this.completeBreakPhase();
    }
  }

  private completeFocusPhase(): void {
    const now = this.now();
    this.state = {
      ...this.state,
      phase: 'break',
      status: 'running',
      phaseStartedAt: now,
      expectedPhaseEndAt: now + this.state.settings.breakMinutes * MINUTES_TO_MS,
      pausedAt: null,
      lastRemainingSeconds: this.state.settings.breakMinutes * 60
    };

    this.events.emit('focus-completed');
    this.emitStateChanged();
  }

  private completeBreakPhase(): void {
    this.clearTicking();
    this.state = {
      ...this.state,
      phase: 'completed',
      status: 'completed',
      expectedPhaseEndAt: null,
      pausedAt: null,
      lastRemainingSeconds: 0
    };

    this.events.emit('session-completed');
    this.emitStateChanged();
  }

  private emitStateChanged(): TimerSnapshot {
    const snapshot = this.getSnapshot();
    this.events.emit('state-changed', snapshot);
    return snapshot;
  }

  private getRemainingSeconds(): number {
    if (this.state.status === 'idle' || this.state.status === 'completed') {
      return 0;
    }

    if (this.state.status === 'paused') {
      return this.state.lastRemainingSeconds;
    }

    if (!this.state.expectedPhaseEndAt) {
      return 0;
    }

    return Math.max(0, Math.ceil((this.state.expectedPhaseEndAt - this.now()) / 1000));
  }

  private getTotalSeconds(): number {
    if (this.state.phase === 'focus') {
      return this.state.settings.focusMinutes * 60;
    }

    if (this.state.phase === 'break') {
      return this.state.settings.breakMinutes * 60;
    }

    return 0;
  }

  private ensureTicking(): void {
    if (this.tickTimer) {
      return;
    }

    this.tickTimer = setInterval(() => this.tick(), TICK_INTERVAL_MS);
  }

  private clearTicking(): void {
    if (!this.tickTimer) {
      return;
    }

    clearInterval(this.tickTimer);
    this.tickTimer = null;
  }

  private createIdleState(settings: TimerSettings): TimerRuntimeState {
    return {
      phase: 'idle',
      status: 'idle',
      settings: this.normalizeSettings(settings),
      startedAt: null,
      phaseStartedAt: null,
      expectedPhaseEndAt: null,
      pausedAt: null,
      lastRemainingSeconds: 0
    };
  }

  private normalizeSettings(settings: TimerSettings): TimerSettings {
    const focusMinutes = Math.trunc(settings.focusMinutes);
    const breakMinutes = Math.trunc(settings.breakMinutes);

    if (!Number.isFinite(focusMinutes) || focusMinutes <= 0) {
      throw new Error('Focus minutes must be a positive number.');
    }

    if (!Number.isFinite(breakMinutes) || breakMinutes <= 0) {
      throw new Error('Break minutes must be a positive number.');
    }

    return {
      focusMinutes,
      breakMinutes,
      showTimer: Boolean(settings.showTimer)
    };
  }
}
