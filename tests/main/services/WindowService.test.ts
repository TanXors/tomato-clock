import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WindowService } from '../../../src/main/services/WindowService';

const electronMock = vi.hoisted(() => {
  interface BrowserWindowOptions {
    backgroundColor: string;
    height: number;
    width: number;
  }

  class BrowserWindowMock {
    static instances: BrowserWindowMock[] = [];
    static isLoadingMainFrame = false;
    static readyToShowCallbacks: Array<() => void> = [];

    readonly options: BrowserWindowOptions;
    readonly center = vi.fn();
    readonly focus = vi.fn();
    readonly getBounds = vi.fn(() => ({
      x: 0,
      y: 0,
      width: this.options.width,
      height: this.options.height
    }));
    readonly hide = vi.fn();
    readonly isDestroyed = vi.fn(() => false);
    readonly loadFile = vi.fn(() => Promise.resolve());
    readonly loadURL = vi.fn(() => Promise.resolve());
    readonly on = vi.fn();
    readonly once = vi.fn((event: string, callback: () => void) => {
      if (event === 'ready-to-show') {
        BrowserWindowMock.readyToShowCallbacks.push(callback);
      }
      return this;
    });
    readonly setBounds = vi.fn();
    readonly setMaximumSize = vi.fn();
    readonly setMenu = vi.fn();
    readonly setMinimumSize = vi.fn();
    readonly show = vi.fn();
    readonly showInactive = vi.fn();
    readonly webContents = {
      isLoadingMainFrame: vi.fn(() => BrowserWindowMock.isLoadingMainFrame),
      send: vi.fn()
    };

    constructor(options: BrowserWindowOptions) {
      this.options = options;
      BrowserWindowMock.instances.push(this);
    }
  }

  return {
    BrowserWindowMock,
    buildFromTemplate: vi.fn(() => ({ popup: vi.fn() })),
    getAppPath: vi.fn(() => 'F:\\Product\\tomato'),
    getPrimaryDisplay: vi.fn(() => ({
      workArea: {
        x: 0,
        y: 0,
        width: 1920,
        height: 1080
      }
    }))
  };
});

vi.mock('electron', () => ({
  BrowserWindow: electronMock.BrowserWindowMock,
  Menu: {
    buildFromTemplate: electronMock.buildFromTemplate
  },
  app: {
    getAppPath: electronMock.getAppPath
  },
  screen: {
    getPrimaryDisplay: electronMock.getPrimaryDisplay
  }
}));

describe('WindowService', () => {
  beforeEach(() => {
    electronMock.BrowserWindowMock.instances.length = 0;
    electronMock.BrowserWindowMock.isLoadingMainFrame = false;
    electronMock.BrowserWindowMock.readyToShowCallbacks.length = 0;
    electronMock.buildFromTemplate.mockClear();
    electronMock.getAppPath.mockClear();
    electronMock.getPrimaryDisplay.mockClear();
  });

  it('waits for framed app windows before showing them', () => {
    const service = new WindowService();
    electronMock.BrowserWindowMock.isLoadingMainFrame = true;

    service.showSettingsWindow();

    const settingsWindow = electronMock.BrowserWindowMock.instances[0];
    expect(settingsWindow.options.backgroundColor).toBe('#ffffff');
    expect(settingsWindow.center).toHaveBeenCalledTimes(1);
    expect(settingsWindow.show).not.toHaveBeenCalled();
    expect(settingsWindow.focus).not.toHaveBeenCalled();

    electronMock.BrowserWindowMock.readyToShowCallbacks[0]?.();

    expect(settingsWindow.show).toHaveBeenCalledTimes(1);
    expect(settingsWindow.focus).toHaveBeenCalledTimes(1);
  });

  it('keeps toast windows on the immediate bottom-right display path', () => {
    const service = new WindowService();
    electronMock.BrowserWindowMock.isLoadingMainFrame = true;

    service.showStartToast();

    const toastWindow = electronMock.BrowserWindowMock.instances[0];
    expect(toastWindow.setBounds).toHaveBeenCalledWith(
      {
        x: 1536,
        y: 964,
        width: 360,
        height: 92
      },
      false
    );
    expect(toastWindow.showInactive).toHaveBeenCalledTimes(1);
    expect(toastWindow.once).not.toHaveBeenCalledWith('ready-to-show', expect.any(Function));
  });
});
