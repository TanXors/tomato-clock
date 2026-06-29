import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { TimerPhase, TimerSettings, TimerSnapshot } from '../../shared/types';
import { DEFAULT_TIMER_SETTINGS } from '../../shared/types';
import './styles.css';

type ViewName = 'settings' | 'menu' | 'timer-display' | 'timer-detail' | 'complete' | 'toast';

function App(): ReactElement {
  const params = new URLSearchParams(window.location.search);
  const view = (params.get('view') ?? 'settings') as ViewName;

  if (view === 'menu') {
    return <MenuPage />;
  }

  if (view === 'timer-display') {
    return <TimerDisplayPage />;
  }

  if (view === 'timer-detail') {
    return <TimerDetailPage />;
  }

  if (view === 'complete') {
    return <TimerCompletePage />;
  }

  if (view === 'toast') {
    return <ToastView type={params.get('type') === 'focus-complete' ? 'focus-complete' : 'start'} />;
  }

  return <TimerSettingsPage />;
}

function TimerSettingsPage(): ReactElement {
  const [focusMinutes, setFocusMinutes] = useState('');
  const [breakMinutes, setBreakMinutes] = useState('');
  const [showTimer, setShowTimer] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    async function loadSettings(): Promise<void> {
      const settings = await window.tomatoApi.getSettings();
      if (ignore) {
        return;
      }

      setFocusMinutes(String(settings.focusMinutes));
      setBreakMinutes(String(settings.breakMinutes));
      setShowTimer(settings.showTimer);
    }

    void loadSettings();
    return () => {
      ignore = true;
    };
  }, []);

  const parsedSettings = useMemo(() => {
    const focusValue = Number(focusMinutes);
    const breakValue = Number(breakMinutes);

    if (!Number.isInteger(focusValue) || focusValue <= 0) {
      return null;
    }

    if (!Number.isInteger(breakValue) || breakValue <= 0) {
      return null;
    }

    return {
      focusMinutes: focusValue,
      breakMinutes: breakValue,
      showTimer
    };
  }, [breakMinutes, focusMinutes, showTimer]);

  async function handleStart(): Promise<void> {
    if (!parsedSettings) {
      setError('请输入有效的专注和休息时间');
      return;
    }

    setError('');
    await window.tomatoApi.startTimer(parsedSettings);
  }

  async function handleReset(): Promise<void> {
    setFocusMinutes('');
    setBreakMinutes('');
    setShowTimer(false);
    setError('');
    await window.tomatoApi.clearSettings();
  }

  return (
    <main className="app-window settings-window">
      <section className="panel">
        <div className="brand-row">
          <div>
            <p className="eyebrow">tomato</p>
            <h1>设置计时</h1>
          </div>
          <div className="tomato-mark" aria-hidden="true" />
        </div>

        <label className="field">
          <span>专注时间</span>
          <div className="input-shell">
            <input
              min="1"
              type="number"
              value={focusMinutes}
              onChange={(event) => setFocusMinutes(event.target.value)}
              placeholder={String(DEFAULT_TIMER_SETTINGS.focusMinutes)}
            />
            <span>分钟</span>
          </div>
        </label>

        <label className="field">
          <span>休息时间</span>
          <div className="input-shell">
            <input
              min="1"
              type="number"
              value={breakMinutes}
              onChange={(event) => setBreakMinutes(event.target.value)}
              placeholder={String(DEFAULT_TIMER_SETTINGS.breakMinutes)}
            />
            <span>分钟</span>
          </div>
        </label>

        <label className="check-row">
          <input checked={showTimer} type="checkbox" onChange={(event) => setShowTimer(event.target.checked)} />
          <span>显示计时</span>
        </label>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="action-row">
          <button className="ghost-button" type="button" onClick={() => void handleReset()}>
            重置设置
          </button>
          <button className="primary-button" disabled={!parsedSettings} type="button" onClick={() => void handleStart()}>
            开始计时
          </button>
        </div>
      </section>
    </main>
  );
}

function MenuPage(): ReactElement {
  const timerState = useTimerState();
  const [displayVisible, setDisplayVisible] = useState(false);
  const isPaused = timerState.status === 'paused';
  const isActive = timerState.status === 'running' || timerState.status === 'paused';

  useEffect(() => {
    setDisplayVisible(timerState.settings.showTimer);
  }, [timerState.settings.showTimer]);

  async function handleDisplayToggle(nextValue: boolean): Promise<void> {
    setDisplayVisible(nextValue);
    if (nextValue) {
      await window.tomatoApi.showTimerDisplayWindow();
      return;
    }

    await window.tomatoApi.hideTimerDisplayWindow();
  }

  return (
    <main className="app-window compact-window">
      <section className="panel menu-panel">
        <p className="eyebrow">当前计时</p>
        <h1>{phaseText(timerState.phase)}</h1>
        <TimerText seconds={timerState.remainingSeconds} />

        <label className="check-row">
          <input
            checked={displayVisible}
            type="checkbox"
            onChange={(event) => void handleDisplayToggle(event.target.checked)}
          />
          <span>显示计时</span>
        </label>

        <div className="stack-actions">
          <button
            className="primary-button"
            disabled={!isActive}
            type="button"
            onClick={() => void (isPaused ? window.tomatoApi.resumeTimer() : window.tomatoApi.pauseTimer())}
          >
            {isPaused ? '恢复计时' : '暂停计时'}
          </button>
          <button className="ghost-button" disabled={!isActive} type="button" onClick={() => void window.tomatoApi.restartTimer()}>
            重启计时
          </button>
        </div>
      </section>
    </main>
  );
}

function TimerDisplayPage(): ReactElement {
  const timerState = useTimerState();
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);

  return (
    <main
      className="display-window"
      onClick={() => setMenuPosition(null)}
      onContextMenu={(event) => {
        event.preventDefault();
        setMenuPosition({ x: event.clientX, y: event.clientY });
      }}
    >
      <p>{phaseText(timerState.phase)}</p>
      <strong>{formatSeconds(timerState.remainingSeconds)}</strong>
      {menuPosition ? (
        <div className="context-menu" style={{ left: menuPosition.x, top: menuPosition.y }}>
          <button type="button" onClick={() => void window.tomatoApi.showTimerDetailWindow()}>
            查看详情
          </button>
          <button type="button" onClick={() => void window.tomatoApi.hideTimerDisplayWindow()}>
            关闭
          </button>
        </div>
      ) : null}
    </main>
  );
}

function TimerDetailPage(): ReactElement {
  const timerState = useTimerState();

  return (
    <main className="app-window detail-window">
      <section className="panel">
        <p className="eyebrow">计时详情</p>
        <h1>{phaseText(timerState.phase)}</h1>
        <TimerText seconds={timerState.remainingSeconds} />
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${Math.round(timerState.progress * 100)}%` }} />
        </div>
        <dl className="detail-list">
          <div>
            <dt>状态</dt>
            <dd>{statusText(timerState.status)}</dd>
          </div>
          <div>
            <dt>专注</dt>
            <dd>{timerState.settings.focusMinutes} 分钟</dd>
          </div>
          <div>
            <dt>休息</dt>
            <dd>{timerState.settings.breakMinutes} 分钟</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}

function TimerCompletePage(): ReactElement {
  return (
    <main className="app-window complete-window">
      <section className="panel complete-panel">
        <div className="tomato-mark large" aria-hidden="true" />
        <p className="eyebrow">本轮完成</p>
        <h1>做得很好</h1>
        <div className="action-row">
          <button className="ghost-button" type="button" onClick={() => void window.tomatoApi.finishSession()}>
            结束
          </button>
          <button className="primary-button" type="button" onClick={() => void window.tomatoApi.againFocus()}>
            再次专注
          </button>
        </div>
      </section>
    </main>
  );
}

function ToastView({ type }: { type: 'start' | 'focus-complete' }): ReactElement {
  const isFocusComplete = type === 'focus-complete';

  return (
    <main className="toast-window">
      <div className="toast-dot" />
      <div>
        <p>{isFocusComplete ? '专注结束' : '计时开始'}</p>
        <strong>{isFocusComplete ? '该休息啦' : '进入专注状态'}</strong>
      </div>
    </main>
  );
}

function TimerText({ seconds }: { seconds: number }): ReactElement {
  return <div className="timer-text">{formatSeconds(seconds)}</div>;
}

function useTimerState(): TimerSnapshot {
  const [state, setState] = useState<TimerSnapshot>({
    phase: 'idle',
    status: 'idle',
    settings: DEFAULT_TIMER_SETTINGS,
    startedAt: null,
    phaseStartedAt: null,
    expectedPhaseEndAt: null,
    pausedAt: null,
    remainingSeconds: 0,
    totalSeconds: 0,
    progress: 0
  });

  useEffect(() => {
    let ignore = false;

    async function loadState(): Promise<void> {
      const snapshot = await window.tomatoApi.getTimerState();
      if (!ignore) {
        setState(snapshot);
      }
    }

    void loadState();
    const unsubscribe = window.tomatoApi.onTimerStateChanged((snapshot) => setState(snapshot));

    return () => {
      ignore = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setState((currentState) => deriveCurrentSnapshot(currentState));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return state;
}

function deriveCurrentSnapshot(snapshot: TimerSnapshot): TimerSnapshot {
  if (snapshot.status !== 'running' || !snapshot.expectedPhaseEndAt) {
    return snapshot;
  }

  const remainingSeconds = Math.max(0, Math.ceil((snapshot.expectedPhaseEndAt - Date.now()) / 1000));
  const progress =
    snapshot.totalSeconds === 0
      ? 0
      : Math.min(1, Math.max(0, (snapshot.totalSeconds - remainingSeconds) / snapshot.totalSeconds));

  if (remainingSeconds === snapshot.remainingSeconds && progress === snapshot.progress) {
    return snapshot;
  }

  return {
    ...snapshot,
    remainingSeconds,
    progress
  };
}

function formatSeconds(seconds: number): string {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const restSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(restSeconds).padStart(2, '0')}`;
}

function phaseText(phase: TimerPhase): string {
  if (phase === 'focus') {
    return '专注中';
  }

  if (phase === 'break') {
    return '休息中';
  }

  if (phase === 'completed') {
    return '已完成';
  }

  return '未开始';
}

function statusText(status: TimerSnapshot['status']): string {
  if (status === 'running') {
    return '运行中';
  }

  if (status === 'paused') {
    return '已暂停';
  }

  if (status === 'completed') {
    return '已完成';
  }

  return '未开始';
}

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element is missing.');
}

createRoot(root).render(<App />);
