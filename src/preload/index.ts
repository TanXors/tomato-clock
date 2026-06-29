import { contextBridge, ipcRenderer } from 'electron';
import type { TimerSettings, TimerSnapshot, TimerStateListener, TomatoApi } from '../shared/types';

const tomatoApi: TomatoApi = {
  startTimer: (settings: TimerSettings) => ipcRenderer.invoke('timer:start', settings),
  pauseTimer: () => ipcRenderer.invoke('timer:pause'),
  resumeTimer: () => ipcRenderer.invoke('timer:resume'),
  restartTimer: () => ipcRenderer.invoke('timer:restart'),
  getTimerState: () => ipcRenderer.invoke('timer:get-state'),
  onTimerStateChanged: (listener: TimerStateListener) => {
    const wrappedListener = (_event: Electron.IpcRendererEvent, state: TimerSnapshot): void => listener(state);
    ipcRenderer.on('timer:state-changed', wrappedListener);
    return () => ipcRenderer.off('timer:state-changed', wrappedListener);
  },
  getSettings: () => ipcRenderer.invoke('settings:get'),
  clearSettings: () => ipcRenderer.invoke('settings:clear'),
  showMenuWindow: () => ipcRenderer.invoke('window:show-menu'),
  showTimerDisplayWindow: () => ipcRenderer.invoke('window:show-timer-display'),
  hideTimerDisplayWindow: () => ipcRenderer.invoke('window:hide-timer-display'),
  showTimerDetailWindow: () => ipcRenderer.invoke('window:show-timer-detail'),
  showSettingsWindow: () => ipcRenderer.invoke('window:show-settings'),
  againFocus: () => ipcRenderer.invoke('session:again-focus'),
  finishSession: () => ipcRenderer.invoke('session:finish')
};

contextBridge.exposeInMainWorld('tomatoApi', tomatoApi);
