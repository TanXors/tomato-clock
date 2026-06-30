import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_TIMER_SETTINGS } from '../../../src/shared/types';
import { SettingsService } from '../../../src/main/services/SettingsService';

describe('SettingsService', () => {
  let userDataPath: string;
  let service: SettingsService;

  beforeEach(async () => {
    userDataPath = await mkdtemp(join(tmpdir(), 'tomato-settings-'));
    service = new SettingsService(userDataPath);
  });

  afterEach(async () => {
    await rm(userDataPath, { recursive: true, force: true });
  });

  it('returns defaults when settings file is missing', async () => {
    await expect(service.getSettings()).resolves.toEqual(DEFAULT_TIMER_SETTINGS);
  });

  it('saves and reads timer settings', async () => {
    const settings = { focusMinutes: 30, breakMinutes: 5, showTimer: true };

    await service.saveSettings(settings);

    await expect(service.getSettings()).resolves.toEqual(settings);
  });

  it('falls back to defaults when settings JSON is damaged', async () => {
    await writeFile(join(userDataPath, 'settings.json'), '{bad json', 'utf8');

    await expect(service.getSettings()).resolves.toEqual(DEFAULT_TIMER_SETTINGS);
  });

  it('throws non-recoverable read errors', async () => {
    await mkdir(join(userDataPath, 'settings.json'));

    await expect(service.getSettings()).rejects.toThrow();
  });

  it('clears saved settings', async () => {
    await service.saveSettings({ focusMinutes: 20, breakMinutes: 3, showTimer: true });
    await service.clearSettings();

    await expect(service.getSettings()).resolves.toEqual(DEFAULT_TIMER_SETTINGS);
  });
});
