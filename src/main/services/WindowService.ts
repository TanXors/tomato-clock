import { BrowserWindow, Menu, app, screen } from 'electron';
import { join } from 'node:path';
import type { TimerSnapshot } from '../../shared/types';
import { appLifecycle } from '../appLifecycle';

type WindowKind = 'settings' | 'menu' | 'timer-display' | 'timer-detail' | 'complete' | 'toast';

type ToastKind = 'start' | 'focus-complete';

interface WindowSpec {
  width: number;
  height: number;
  frame: boolean;
  transparent?: boolean;
  alwaysOnTop?: boolean;
  skipTaskbar?: boolean;
  resizable?: boolean;
}

const WINDOW_SPECS: Record<WindowKind, WindowSpec> = {
  settings: { width: 420, height: 360, frame: true, resizable: false },
  menu: { width: 320, height: 280, frame: true, resizable: false },
  'timer-display': {
    width: 190,
    height: 78,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false
  },
  'timer-detail': { width: 390, height: 320, frame: true, resizable: false },
  complete: { width: 360, height: 260, frame: true, resizable: false },
  toast: {
    width: 300,
    height: 96,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false
  }
};

export class WindowService {
  private readonly windows = new Map<WindowKind, BrowserWindow>();

  private toastTimer: NodeJS.Timeout | null = null;

  showSettingsWindow(): void {
    const window = this.getOrCreateWindow('settings');
    this.showCentered(window);
  }

  hideSettingsWindow(): void {
    this.windows.get('settings')?.hide();
  }

  showMenuWindow(): void {
    const window = this.getOrCreateWindow('menu');
    this.showCentered(window);
  }

  showTimerDisplayWindow(): void {
    const window = this.getOrCreateWindow('timer-display');
    this.showBottomRight(window, 18, 18);
  }

  hideTimerDisplayWindow(): void {
    this.windows.get('timer-display')?.hide();
  }

  showTimerDetailWindow(): void {
    const window = this.getOrCreateWindow('timer-detail');
    this.showCentered(window);
  }

  showCompleteWindow(): void {
    const window = this.getOrCreateWindow('complete');
    this.showCentered(window);
  }

  showStartToast(): void {
    this.showToast('start', 5000);
  }

  showFocusCompleteToast(): void {
    this.showToast('focus-complete', 60_000);
  }

  closeVisibleWindows(): void {
    for (const window of this.windows.values()) {
      window.hide();
    }
  }

  broadcastTimerState(snapshot: TimerSnapshot): void {
    for (const window of this.windows.values()) {
      if (!window.isDestroyed()) {
        window.webContents.send('timer:state-changed', snapshot);
      }
    }
  }

  dispose(): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }

    for (const window of this.windows.values()) {
      if (!window.isDestroyed()) {
        window.destroy();
      }
    }

    this.windows.clear();
  }

  private showToast(type: ToastKind, durationMs: number): void {
    const window = this.getOrCreateWindow('toast');
    this.loadWindow(window, 'toast', { type });
    this.showBottomRight(window, 18, 112);

    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }

    this.toastTimer = setTimeout(() => {
      window.hide();
      this.toastTimer = null;
    }, durationMs);
  }

  private getOrCreateWindow(kind: WindowKind): BrowserWindow {
    const existingWindow = this.windows.get(kind);
    if (existingWindow && !existingWindow.isDestroyed()) {
      return existingWindow;
    }

    const spec = WINDOW_SPECS[kind];
    const window = new BrowserWindow({
      width: spec.width,
      height: spec.height,
      frame: spec.frame,
      transparent: spec.transparent ?? false,
      alwaysOnTop: spec.alwaysOnTop ?? false,
      skipTaskbar: spec.skipTaskbar ?? false,
      resizable: spec.resizable ?? true,
      show: false,
      title: 'tomato',
      backgroundColor: spec.transparent ? '#00000000' : '#fff8f0',
      webPreferences: {
        preload: join(__dirname, '../preload/index.mjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    });

    window.on('close', (event) => {
      if (appLifecycle.isQuitting) {
        return;
      }

      event.preventDefault();
      window.hide();
    });

    if (kind === 'timer-display') {
      window.setMenu(null);
    } else {
      window.setMenu(Menu.buildFromTemplate([]));
    }

    this.loadWindow(window, kind);
    this.windows.set(kind, window);
    return window;
  }

  private loadWindow(window: BrowserWindow, view: WindowKind, extraQuery: Record<string, string> = {}): void {
    const query = new URLSearchParams({ view, ...extraQuery });

    if (process.env.ELECTRON_RENDERER_URL) {
      void window.loadURL(`${process.env.ELECTRON_RENDERER_URL}?${query.toString()}`);
      return;
    }

    void window.loadFile(join(__dirname, '../renderer/index.html'), {
      query: Object.fromEntries(query.entries())
    });
  }

  private showCentered(window: BrowserWindow): void {
    window.center();
    window.show();
    window.focus();
  }

  private showBottomRight(window: BrowserWindow, marginRight: number, marginBottom: number): void {
    const display = screen.getPrimaryDisplay();
    const { x, y, width, height } = display.workArea;
    const bounds = window.getBounds();

    window.setPosition(x + width - bounds.width - marginRight, y + height - bounds.height - marginBottom);
    window.showInactive();
  }
}
