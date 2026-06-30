import { Menu, Tray, app, nativeImage } from 'electron';
import { appLifecycle } from '../appLifecycle';
import { getAppIconPath } from '../appAssets';
import type { TimerService } from './TimerService';
import type { WindowService } from './WindowService';

export class TrayService {
  private tray: Tray | null = null;

  constructor(
    private readonly windowService: WindowService,
    private readonly timerService: TimerService
  ) {}

  create(): void {
    if (this.tray) {
      return;
    }

    const icon = nativeImage.createFromPath(getAppIconPath('png')).resize({ width: 16, height: 16 });
    this.tray = new Tray(icon);
    this.tray.setToolTip('tomato');
    this.tray.setContextMenu(this.createMenu());
    this.tray.on('click', () => this.showDefaultWindow());
  }

  dispose(): void {
    this.tray?.destroy();
    this.tray = null;
  }

  private createMenu(): Menu {
    return Menu.buildFromTemplate([
      {
        label: '打开菜单',
        click: () => this.windowService.showMenuWindow()
      },
      {
        label: '打开计时显示',
        click: () => this.windowService.showTimerDisplayWindow()
      },
      { type: 'separator' },
      {
        label: '隐藏所有窗口',
        click: () => this.windowService.closeVisibleWindows()
      },
      {
        label: '退出 tomato',
        click: () => {
          appLifecycle.isQuitting = true;
          app.quit();
        }
      }
    ]);
  }

  private showDefaultWindow(): void {
    const snapshot = this.timerService.getSnapshot();
    if (snapshot.status === 'idle' || snapshot.status === 'completed') {
      this.windowService.showSettingsWindow();
      return;
    }

    this.windowService.showMenuWindow();
  }
}
