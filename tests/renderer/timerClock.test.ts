import { describe, expect, it } from 'vitest';
import type { TimerSnapshot } from '../../src/shared/types';
import { deriveCurrentSnapshot, getNextSnapshotUpdateDelay } from '../../src/renderer/src/timerClock';

function createRunningSnapshot(overrides: Partial<TimerSnapshot> = {}): TimerSnapshot {
  return {
    phase: 'focus',
    status: 'running',
    settings: {
      focusMinutes: 45,
      breakMinutes: 10,
      showTimer: true
    },
    startedAt: 1_000,
    phaseStartedAt: 1_000,
    expectedPhaseEndAt: 47_000,
    pausedAt: null,
    remainingSeconds: 46,
    totalSeconds: 60,
    progress: 14 / 60,
    ...overrides
  };
}

describe('timerClock', () => {
  it('updates snapshots from the absolute phase end time', () => {
    const snapshot = createRunningSnapshot();

    expect(deriveCurrentSnapshot(snapshot, 1_050).remainingSeconds).toBe(46);
    expect(deriveCurrentSnapshot(snapshot, 1_980).remainingSeconds).toBe(46);
    expect(deriveCurrentSnapshot(snapshot, 2_020).remainingSeconds).toBe(45);
  });

  it('schedules every window on the same remaining-second boundary', () => {
    const snapshot = createRunningSnapshot();

    expect(getNextSnapshotUpdateDelay(snapshot, 1_050)).toBe(970);
    expect(getNextSnapshotUpdateDelay(snapshot, 1_980)).toBe(40);
  });

  it('does not schedule local ticks when the timer is not running', () => {
    const snapshot = createRunningSnapshot({ status: 'paused' });

    expect(getNextSnapshotUpdateDelay(snapshot, 1_050)).toBeNull();
  });
});
