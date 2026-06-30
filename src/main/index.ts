import { app, ipcMain } from 'electron';
import type { TimerSettings } from '../shared/types';
import { DEFAULT_TIMER_SETTINGS } from '../shared/types';
import { appLifecycle } from './appLifecycle';
import { HotkeyService } from './services/HotkeyService';
import { NotificationService } from './services/NotificationService';
import { SettingsService } from './services/SettingsService';
import { TimerService } from './services/TimerService';
import { TrayService } from './services/TrayService';
import { WindowService } from './services/WindowService';

let timerService: TimerService;
let settingsService: SettingsService;
let windowService: WindowService;
let trayService: TrayService;
let notificationService: NotificationService;
let hotkeyService: HotkeyService;

function registerIpcHandlers(): void {
  ipcMain.handle('timer:start', async (_event, settings: TimerSettings) => {
    const savedSettings = await settingsService.saveSettings(settings);
    timerService.start(savedSettings);
    windowService.hideSettingsWindow();
    windowService.showStartToast();

    if (savedSettings.showTimer) {
      windowService.showTimerDisplayWindow();
    } else {
      windowService.hideTimerDisplayWindow();
    }
  });

  ipcMain.handle('timer:pause', () => {
    timerService.pause();
  });

  ipcMain.handle('timer:resume', () => {
    timerService.resume();
  });

  ipcMain.handle('timer:restart', () => {
    timerService.restart();
  });

  ipcMain.handle('timer:get-state', () => timerService.getSnapshot());

  ipcMain.handle('settings:get', () => settingsService.getSettings());

  ipcMain.handle('settings:clear', async () => {
    await settingsService.clearSettings();
    timerService.resetToIdle(DEFAULT_TIMER_SETTINGS);
  });

  ipcMain.handle('window:show-menu', () => windowService.showMenuWindow());
  ipcMain.handle('window:show-timer-display', () => windowService.showTimerDisplayWindow());
  ipcMain.handle('window:hide-timer-display', () => windowService.hideTimerDisplayWindow());
  ipcMain.handle('window:show-timer-display-context-menu', () => windowService.showTimerDisplayContextMenu());
  ipcMain.handle('window:begin-timer-display-drag', (_event, screenX: number, screenY: number) => {
    windowService.beginTimerDisplayDrag(screenX, screenY);
  });
  ipcMain.handle('window:move-timer-display', (_event, screenX: number, screenY: number) => {
    windowService.moveTimerDisplayWindow(screenX, screenY);
  });
  ipcMain.handle('window:end-timer-display-drag', () => {
    windowService.endTimerDisplayDrag();
  });
  ipcMain.handle('window:show-timer-detail', () => windowService.showTimerDetailWindow());
  ipcMain.handle('window:show-settings', () => windowService.showSettingsWindow());
  ipcMain.handle('window:hide-toast', () => windowService.hideToastWindow());

  ipcMain.handle('session:again-focus', () => {
    timerService.resetToIdle(timerService.getSnapshot().settings);
    windowService.closeVisibleWindows();
    windowService.showSettingsWindow();
  });

  ipcMain.handle('session:finish', () => {
    timerService.resetToIdle(timerService.getSnapshot().settings);
    windowService.closeVisibleWindows();
  });
}

function wireServices(): void {
  timerService.on('state-changed', (snapshot) => {
    windowService.broadcastTimerState(snapshot);
  });

  timerService.on('focus-completed', () => {
    notificationService.playFocusCompletedTone();
    windowService.showFocusCompleteToast();
  });

  timerService.on('session-completed', () => {
    windowService.showCompleteWindow();
  });
}

app.whenReady().then(async () => {
  timerService = new TimerService();
  settingsService = new SettingsService(app.getPath('userData'));
  windowService = new WindowService();
  trayService = new TrayService(windowService, timerService);
  notificationService = new NotificationService();
  hotkeyService = new HotkeyService(windowService);

  registerIpcHandlers();
  wireServices();

  const settings = await settingsService.getSettings();
  timerService.resetToIdle(settings);
  trayService.create();
  hotkeyService.register();
  windowService.showSettingsWindow();
});

app.on('before-quit', () => {
  appLifecycle.isQuitting = true;
  notificationService?.dispose();
  hotkeyService?.dispose();
  trayService?.dispose();
  timerService?.dispose();
  windowService?.dispose();
});

app.on('window-all-closed', () => {});
