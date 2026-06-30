import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimerService } from '../../../src/main/services/TimerService';

describe('TimerService', () => {
  let service: TimerService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-29T12:00:00.000Z'));
    service = new TimerService();
  });

  afterEach(() => {
    service.dispose();
    vi.useRealTimers();
  });

  it('starts in focus phase with a running countdown', () => {
    const snapshot = service.start({ focusMinutes: 45, breakMinutes: 10, showTimer: true });

    expect(snapshot.phase).toBe('focus');
    expect(snapshot.status).toBe('running');
    expect(snapshot.remainingSeconds).toBe(45 * 60);
    expect(snapshot.settings.showTimer).toBe(true);
  });

  it('pauses without consuming remaining time', () => {
    service.start({ focusMinutes: 45, breakMinutes: 10, showTimer: false });
    vi.advanceTimersByTime(10_000);

    const paused = service.pause();
    vi.advanceTimersByTime(20_000);

    expect(paused.status).toBe('paused');
    expect(service.getSnapshot().remainingSeconds).toBe(paused.remainingSeconds);
  });

  it('resumes from the paused remaining time', () => {
    service.start({ focusMinutes: 45, breakMinutes: 10, showTimer: false });
    vi.advanceTimersByTime(10_000);
    const paused = service.pause();
    vi.advanceTimersByTime(20_000);

    const resumed = service.resume();

    expect(resumed.status).toBe('running');
    expect(resumed.remainingSeconds).toBe(paused.remainingSeconds);
  });

  it('restarts the current session from focus phase', () => {
    service.start({ focusMinutes: 45, breakMinutes: 10, showTimer: false });
    vi.advanceTimersByTime(30_000);

    const restarted = service.restart();

    expect(restarted.phase).toBe('focus');
    expect(restarted.status).toBe('running');
    expect(restarted.remainingSeconds).toBe(45 * 60);
  });

  it('moves from focus to break and completes after break', () => {
    const focusCompleted = vi.fn();
    const sessionCompleted = vi.fn();
    service.on('focus-completed', focusCompleted);
    service.on('session-completed', sessionCompleted);

    service.start({ focusMinutes: 1, breakMinutes: 1, showTimer: false });
    vi.advanceTimersByTime(60_000);

    expect(focusCompleted).toHaveBeenCalledTimes(1);
    expect(service.getSnapshot().phase).toBe('break');
    expect(service.getSnapshot().remainingSeconds).toBe(60);

    vi.advanceTimersByTime(60_000);

    expect(sessionCompleted).toHaveBeenCalledTimes(1);
    expect(service.getSnapshot().phase).toBe('completed');
    expect(service.getSnapshot().status).toBe('completed');
    expect(service.getSnapshot().remainingSeconds).toBe(0);
  });
});
