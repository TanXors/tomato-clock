import { shell } from 'electron';

export class NotificationService {
  private focusToneTimers: NodeJS.Timeout[] = [];

  playFocusCompletedTone(): void {
    this.clearTones();
    this.focusToneTimers = [
      setTimeout(() => shell.beep(), 0),
      setTimeout(() => shell.beep(), 700)
    ];
  }

  dispose(): void {
    this.clearTones();
  }

  private clearTones(): void {
    for (const timer of this.focusToneTimers) {
      clearTimeout(timer);
    }

    this.focusToneTimers = [];
  }
}
