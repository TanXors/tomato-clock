import type { TimerSnapshot } from '../../shared/types';

const TIMER_TICK_SETTLE_MS = 20;

export function deriveCurrentSnapshot(snapshot: TimerSnapshot, now = Date.now()): TimerSnapshot {
  if (snapshot.status !== 'running' || !snapshot.expectedPhaseEndAt) {
    return snapshot;
  }

  const remainingSeconds = Math.max(0, Math.ceil((snapshot.expectedPhaseEndAt - now) / 1000));
  const progress =
    snapshot.totalSeconds === 0
      ? 0
      : Math.min(1, Math.max(0, (snapshot.totalSeconds - remainingSeconds) / snapshot.totalSeconds));

  if (remainingSeconds === snapshot.remainingSeconds && progress === snapshot.progress) {
    return snapshot;
  }

  return {
    ...snapshot,
    remainingSeconds,
    progress
  };
}

export function getNextSnapshotUpdateDelay(snapshot: TimerSnapshot, now = Date.now()): number | null {
  if (snapshot.status !== 'running' || !snapshot.expectedPhaseEndAt) {
    return null;
  }

  const remainingMilliseconds = snapshot.expectedPhaseEndAt - now;
  if (remainingMilliseconds <= 0) {
    return null;
  }

  const millisecondsUntilSecondBoundary = remainingMilliseconds % 1000;
  const baseDelay = millisecondsUntilSecondBoundary === 0 ? 1000 : millisecondsUntilSecondBoundary;
  return baseDelay + TIMER_TICK_SETTLE_MS;
}
