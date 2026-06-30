import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { DEFAULT_TIMER_SETTINGS, type TimerSettings } from '../../shared/types';

export class SettingsService {
  private readonly settingsPath: string;

  constructor(userDataPath: string) {
    this.settingsPath = join(userDataPath, 'settings.json');
  }

  async getSettings(): Promise<TimerSettings> {
    try {
      const raw = await readFile(this.settingsPath, 'utf8');
      return this.parseSettings(raw);
    } catch (error) {
      if (this.isFileMissing(error) || this.isJsonParseError(error)) {
        return DEFAULT_TIMER_SETTINGS;
      }

      throw error;
    }
  }

  async saveSettings(settings: TimerSettings): Promise<TimerSettings> {
    const normalizedSettings = this.normalizeSettings(settings);
    await mkdir(dirname(this.settingsPath), { recursive: true });
    await writeFile(this.settingsPath, `${JSON.stringify(normalizedSettings, null, 2)}\n`, 'utf8');
    return normalizedSettings;
  }

  async clearSettings(): Promise<void> {
    try {
      await rm(this.settingsPath);
    } catch (error) {
      if (!this.isFileMissing(error)) {
        throw error;
      }
    }
  }

  private parseSettings(raw: string): TimerSettings {
    const parsed = JSON.parse(raw) as Partial<TimerSettings>;
    return this.normalizeSettings({
      focusMinutes: Number(parsed.focusMinutes),
      breakMinutes: Number(parsed.breakMinutes),
      showTimer: Boolean(parsed.showTimer)
    });
  }

  private normalizeSettings(settings: TimerSettings): TimerSettings {
    const focusMinutes = Math.trunc(settings.focusMinutes);
    const breakMinutes = Math.trunc(settings.breakMinutes);

    if (!Number.isFinite(focusMinutes) || focusMinutes <= 0) {
      return DEFAULT_TIMER_SETTINGS;
    }

    if (!Number.isFinite(breakMinutes) || breakMinutes <= 0) {
      return DEFAULT_TIMER_SETTINGS;
    }

    return {
      focusMinutes,
      breakMinutes,
      showTimer: Boolean(settings.showTimer)
    };
  }

  private isFileMissing(error: unknown): boolean {
    return error instanceof Error && 'code' in error && error.code === 'ENOENT';
  }

  private isJsonParseError(error: unknown): boolean {
    return error instanceof SyntaxError;
  }
}
