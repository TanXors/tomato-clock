export type TimerPhase = 'idle' | 'focus' | 'break' | 'completed';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed';

export interface TimerSettings {
  focusMinutes: number;
  breakMinutes: number;
  showTimer: boolean;
}

export interface TimerSnapshot {
  phase: TimerPhase;
  status: TimerStatus;
  settings: TimerSettings;
  startedAt: number | null;
  phaseStartedAt: number | null;
  expectedPhaseEndAt: number | null;
  pausedAt: number | null;
  remainingSeconds: number;
  totalSeconds: number;
  progress: number;
}

export type TimerStateListener = (state: TimerSnapshot) => void;

export interface TomatoApi {
  startTimer(settings: TimerSettings): Promise<void>;
  pauseTimer(): Promise<void>;
  resumeTimer(): Promise<void>;
  restartTimer(): Promise<void>;
  getTimerState(): Promise<TimerSnapshot>;
  onTimerStateChanged(listener: TimerStateListener): () => void;
  getSettings(): Promise<TimerSettings>;
  clearSettings(): Promise<void>;
  showMenuWindow(): Promise<void>;
  showTimerDisplayWindow(): Promise<void>;
  hideTimerDisplayWindow(): Promise<void>;
  showTimerDetailWindow(): Promise<void>;
  showSettingsWindow(): Promise<void>;
  againFocus(): Promise<void>;
  finishSession(): Promise<void>;
}

export const DEFAULT_TIMER_SETTINGS: TimerSettings = {
  focusMinutes: 45,
  breakMinutes: 10,
  showTimer: false
};
