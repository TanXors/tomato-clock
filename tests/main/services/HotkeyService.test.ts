import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HotkeyService } from '../../../src/main/services/HotkeyService';
import type { WindowService } from '../../../src/main/services/WindowService';

const electronMock = vi.hoisted(() => ({
  register: vi.fn((_accelerator: string, _callback: () => void): boolean => true),
  unregister: vi.fn()
}));

vi.mock('electron', () => ({
  globalShortcut: electronMock
}));

describe('HotkeyService', () => {
  beforeEach(() => {
    electronMock.register.mockClear();
    electronMock.unregister.mockClear();
  });

  it('registers timer display and menu hotkeys', () => {
    const windowService = {
      showTimerDisplayWindow: vi.fn(),
      showMenuWindow: vi.fn()
    } as unknown as WindowService;
    const service = new HotkeyService(windowService);

    service.register();

    expect(electronMock.register).toHaveBeenCalledTimes(2);
    expect(electronMock.register).toHaveBeenNthCalledWith(1, 'Control+Alt+T', expect.any(Function));
    expect(electronMock.register).toHaveBeenNthCalledWith(2, 'Control+Alt+M', expect.any(Function));

    const openTimer = electronMock.register.mock.calls[0]?.[1];
    const openMenu = electronMock.register.mock.calls[1]?.[1];
    openTimer?.();
    openMenu?.();

    expect(windowService.showTimerDisplayWindow).toHaveBeenCalledTimes(1);
    expect(windowService.showMenuWindow).toHaveBeenCalledTimes(1);
  });

  it('unregisters registered hotkeys on dispose', () => {
    const service = new HotkeyService({} as WindowService);

    service.register();
    service.dispose();

    expect(electronMock.unregister).toHaveBeenCalledWith('Control+Alt+T');
    expect(electronMock.unregister).toHaveBeenCalledWith('Control+Alt+M');
  });
});
