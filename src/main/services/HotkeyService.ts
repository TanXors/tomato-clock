import { globalShortcut } from 'electron';
import type { WindowService } from './WindowService';

interface HotkeyBinding {
  accelerator: string;
  action: () => void;
}

export class HotkeyService {
  private readonly registeredAccelerators: string[] = [];

  constructor(private readonly windowService: WindowService) {}

  register(): void {
    const bindings: HotkeyBinding[] = [
      {
        accelerator: 'Control+Alt+T',
        action: () => this.windowService.showTimerDisplayWindow()
      },
      {
        accelerator: 'Control+Alt+M',
        action: () => this.windowService.showMenuWindow()
      }
    ];

    for (const binding of bindings) {
      const registered = globalShortcut.register(binding.accelerator, binding.action);
      if (registered) {
        this.registeredAccelerators.push(binding.accelerator);
      }
    }
  }

  dispose(): void {
    for (const accelerator of this.registeredAccelerators) {
      globalShortcut.unregister(accelerator);
    }

    this.registeredAccelerators.length = 0;
  }
}
