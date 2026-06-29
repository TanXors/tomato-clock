import { Menu, Tray, app, nativeImage } from 'electron';
import { appLifecycle } from '../appLifecycle';
import type { WindowService } from './WindowService';

const TRAY_ICON =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAALUlEQVR42mP8z8AARLJgwiA2SBFI0P8fBgaG/6AqRkYGJgYGBgYGACRIBQ75h6nFAAAAAElFTkSuQmCC';

export class TrayService {
  private tray: Tray | null = null;

  constructor(private readonly windowService: WindowService) {}

  create(): void {
    if (this.tray) {
      return;
    }

    const icon = nativeImage.createFromDataURL(TRAY_ICON);
    this.tray = new Tray(icon);
    this.tray.setToolTip('tomato');
    this.tray.setContextMenu(this.createMenu());
    this.tray.on('click', () => this.windowService.showMenuWindow());
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
      {
        label: '查看详情',
        click: () => this.windowService.showTimerDetailWindow()
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
}
