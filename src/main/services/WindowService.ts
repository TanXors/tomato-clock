import { BrowserWindow, Menu, app, screen } from 'electron';
import { join } from 'node:path';
import type { TimerSnapshot } from '../../shared/types';
import { appLifecycle } from '../appLifecycle';
import { getAppIconPath } from '../appAssets';

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
  settings: { width: 380, height: 520, frame: true, resizable: true },
  menu: { width: 320, height: 360, frame: true, resizable: true },
  'timer-display': {
    width: 176,
    height: 116,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false
  },
  'timer-detail': { width: 380, height: 560, frame: true, resizable: true },
  complete: { width: 380, height: 526, frame: true, resizable: true },
  toast: {
    width: 360,
    height: 92,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false
  }
};

export class WindowService {
  private readonly windows = new Map<WindowKind, BrowserWindow>();

  private timerDisplayDragStart: { windowX: number; windowY: number; pointerX: number; pointerY: number } | null = null;

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

  hideMenuWindow(): void {
    this.windows.get('menu')?.hide();
  }

  showTimerDisplayWindow(): void {
    const window = this.getOrCreateWindow('timer-display');
    this.showBottomRight(window, 18, 18);
  }

  hideTimerDisplayWindow(): void {
    this.endTimerDisplayDrag();
    this.windows.get('timer-display')?.hide();
  }

  beginTimerDisplayDrag(screenX: number, screenY: number): void {
    if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) {
      return;
    }

    const window = this.windows.get('timer-display');
    if (!window || window.isDestroyed()) {
      return;
    }

    const bounds = window.getBounds();
    this.timerDisplayDragStart = {
      windowX: bounds.x,
      windowY: bounds.y,
      pointerX: screenX,
      pointerY: screenY
    };
  }

  moveTimerDisplayWindow(screenX: number, screenY: number): void {
    if (!Number.isFinite(screenX) || !Number.isFinite(screenY) || !this.timerDisplayDragStart) {
      return;
    }

    const window = this.windows.get('timer-display');
    if (!window || window.isDestroyed()) {
      return;
    }

    const spec = WINDOW_SPECS['timer-display'];
    const offsetX = Math.trunc(screenX - this.timerDisplayDragStart.pointerX);
    const offsetY = Math.trunc(screenY - this.timerDisplayDragStart.pointerY);
    window.setBounds(
      {
        x: this.timerDisplayDragStart.windowX + offsetX,
        y: this.timerDisplayDragStart.windowY + offsetY,
        width: spec.width,
        height: spec.height
      },
      false
    );
  }

  endTimerDisplayDrag(): void {
    this.timerDisplayDragStart = null;
  }

  showTimerDisplayContextMenu(): void {
    const window = this.windows.get('timer-display');
    if (!window || window.isDestroyed()) {
      return;
    }

    Menu.buildFromTemplate([
      {
        label: '查看详情',
        click: () => this.showTimerDetailWindow()
      },
      {
        label: '关闭',
        click: () => this.hideTimerDisplayWindow()
      }
    ]).popup({ window });
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

  hideToastWindow(): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }

    this.windows.get('toast')?.hide();
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
    this.showBottomRight(window, 24, 24);

    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }

    this.toastTimer = setTimeout(() => {
      this.hideToastWindow();
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
      minimizable: true,
      maximizable: spec.resizable ?? true,
      show: false,
      title: 'tomato',
      icon: getAppIconPath('ico'),
      backgroundColor: spec.transparent ? '#00000000' : '#fbf7ed',
      webPreferences: {
        preload: join(__dirname, '../preload/index.mjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });

    if (kind === 'timer-display') {
      window.setMinimumSize(spec.width, spec.height);
      window.setMaximumSize(spec.width, spec.height);
    }

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
    window.setBounds(
      {
        x: x + width - bounds.width - marginRight,
        y: y + height - bounds.height - marginBottom,
        width: bounds.width,
        height: bounds.height
      },
      false
    );
    window.showInactive();
  }
}
