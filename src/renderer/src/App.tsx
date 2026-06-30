import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactElement, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import type { TimerPhase, TimerSnapshot } from '../../shared/types';
import { DEFAULT_TIMER_SETTINGS } from '../../shared/types';
import focusCompleteAlarmUrl from './assets/focus-complete-alarm.mp3';
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
      <WindowFrame title="Tomato" lights="two">
        <section className="panel">
          <div className="brand-row">
            <TomatoIcon />
            <div>
              <h1>番茄钟</h1>
              <p className="subtle-text">专注工作，高效休息</p>
            </div>
          </div>

          <label className="field">
            <span>专注时间（分钟）</span>
            <div className="input-shell">
              <input
                min="1"
                type="number"
                value={focusMinutes}
                onChange={(event) => setFocusMinutes(event.target.value)}
                placeholder={String(DEFAULT_TIMER_SETTINGS.focusMinutes)}
              />
              <span>min</span>
            </div>
          </label>

          <label className="field">
            <span>休息时间（分钟）</span>
            <div className="input-shell">
              <input
                min="1"
                type="number"
                value={breakMinutes}
                onChange={(event) => setBreakMinutes(event.target.value)}
                placeholder={String(DEFAULT_TIMER_SETTINGS.breakMinutes)}
              />
              <span>min</span>
            </div>
          </label>

          <label className="check-row">
            <input checked={showTimer} type="checkbox" onChange={(event) => setShowTimer(event.target.checked)} />
            <span>显示计时</span>
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <div className="divider" />
          <div className="action-row">
            <button className="primary-button" disabled={!parsedSettings} type="button" onClick={() => void handleStart()}>
              开始计时
            </button>
            <button className="ghost-button" type="button" onClick={() => void handleReset()}>
              重置
            </button>
          </div>
          <p className="footer-note">默认：专注 45min / 休息 10min</p>
        </section>
      </WindowFrame>
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
      <WindowFrame title="Tomato · 菜单" lights="two">
        <section className="panel menu-panel">
          <div className="menu-status-block">
            <span>当前状态</span>
            <strong>{phaseText(timerState.phase)}</strong>
          </div>
          <div className="menu-remaining-row">
            <span>剩余时间</span>
            <strong>{formatSeconds(timerState.remainingSeconds)}</strong>
          </div>
          <div className="divider" />
          <label className="check-row">
            <input
              checked={displayVisible}
              type="checkbox"
              onChange={(event) => void handleDisplayToggle(event.target.checked)}
            />
            <span>显示计时</span>
          </label>

          <div className="stack-actions">
          {isPaused ? (
            <button
              className="success-button wide"
              disabled={!isActive}
              type="button"
              onClick={() => void window.tomatoApi.resumeTimer()}
            >
              恢复计时
            </button>
          ) : (
            <button
              className="danger-button wide"
              disabled={!isActive}
              type="button"
              onClick={() => void window.tomatoApi.pauseTimer()}
            >
              暂停计时
            </button>
          )}
            <button
              className="ghost-button wide"
              disabled={!isActive}
              type="button"
              onClick={() => void window.tomatoApi.restartTimer()}
            >
              重启计时
            </button>
          </div>
          <div className="divider" />
          <div className="setting-row">
            <span>专注 {timerState.settings.focusMinutes}min</span>
            <span>休息 {timerState.settings.breakMinutes}min</span>
          </div>
        </section>
      </WindowFrame>
    </main>
  );
}

function TimerDisplayPage(): ReactElement {
  const timerState = useTimerState();
  const activeDragPointerId = useRef<number | null>(null);

  useEffect(() => {
    document.body.classList.add('is-timer-display');
    return () => document.body.classList.remove('is-timer-display');
  }, []);

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>): void {
    if (event.button !== 0) {
      return;
    }

    activeDragPointerId.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    void window.tomatoApi.beginTimerDisplayDrag(event.screenX, event.screenY);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLElement>): void {
    if (activeDragPointerId.current !== event.pointerId) {
      return;
    }

    void window.tomatoApi.moveTimerDisplayWindow(event.screenX, event.screenY);
  }

  function finishDrag(event: ReactPointerEvent<HTMLElement>): void {
    if (activeDragPointerId.current !== event.pointerId) {
      return;
    }

    activeDragPointerId.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    void window.tomatoApi.endTimerDisplayDrag();
  }

  function handleLostPointerCapture(event: ReactPointerEvent<HTMLElement>): void {
    if (activeDragPointerId.current !== event.pointerId) {
      return;
    }

    activeDragPointerId.current = null;
    void window.tomatoApi.endTimerDisplayDrag();
  }

  return (
    <main
      className="display-window"
      onLostPointerCapture={handleLostPointerCapture}
      onContextMenu={(event) => {
        event.preventDefault();
        void window.tomatoApi.showTimerDisplayContextMenu();
      }}
      onPointerCancel={finishDrag}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
    >
      <div className="display-status">
        {detailStatusText(timerState.phase)}
      </div>
      <strong>{formatSeconds(timerState.remainingSeconds)}</strong>
    </main>
  );
}

function TimerDetailPage(): ReactElement {
  const timerState = useTimerState();
  const progressPercent = Math.round(timerState.progress * 100);

  return (
    <main className="app-window detail-window">
      <WindowFrame title="Tomato · 计时详情" lights="three">
        <section className="panel detail-panel">
          <div
            className="progress-ring"
            style={{ '--progress-degree': `${Math.round(timerState.progress * 360)}deg` } as CSSProperties}
            aria-label={`当前进度 ${progressPercent}%`}
          >
            <div className="progress-ring-inner">
              <strong>{formatSeconds(timerState.remainingSeconds)}</strong>
              <span>剩余</span>
            </div>
          </div>
          <span className="phase-pill">
            <span />
            {phaseText(timerState.phase)}
          </span>
          <div className="progress-summary">
            <span>进度</span>
            <strong>{progressPercent}%</strong>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="stat-grid">
            <StatCard value={formatSeconds(timerState.totalSeconds - timerState.remainingSeconds)} label="已用时" />
            <StatCard value={formatSeconds(timerState.remainingSeconds)} label="剩余" />
            <StatCard value={`${progressPercent}%`} label="完成" />
          </div>
          <div className="divider" />
          <dl className="detail-list">
            <div>
              <dt>计时状态</dt>
              <dd>{detailStatusText(timerState.phase)}</dd>
            </div>
            <div>
              <dt>专注时长</dt>
              <dd>{timerState.settings.focusMinutes} 分钟</dd>
            </div>
            <div>
              <dt>休息时长</dt>
              <dd>{timerState.settings.breakMinutes} 分钟</dd>
            </div>
          </dl>
        </section>
      </WindowFrame>
    </main>
  );
}

function TimerCompletePage(): ReactElement {
  const timerState = useTimerState();

  return (
    <main className="app-window complete-window">
      <WindowFrame title="Tomato · 计时完成" lights="two">
        <section className="panel complete-panel">
          <TomatoIcon large />
          <h1>计时完成！</h1>
          <p className="complete-copy">
            本轮专注和休息都完成了
            <br />
            好棒，又完成一次专注！今天也有好好生活哦
            <br />
            ฅ^•ﻌ•^ฅ
          </p>
          <div className="complete-stats">
            <StatCard value={String(timerState.settings.focusMinutes)} label="专注 min" />
            <StatCard value={String(timerState.settings.breakMinutes)} label="休息 min" />
          </div>
          <div className="stack-actions">
            <button className="primary-button wide" type="button" onClick={() => void window.tomatoApi.againFocus()}>
              再次专注
            </button>
            <button className="ghost-button wide" type="button" onClick={() => void window.tomatoApi.finishSession()}>
              结束
            </button>
          </div>
          <p className="footer-note">点击“结束”将关闭所有页面，程序继续在后台运行</p>
        </section>
      </WindowFrame>
    </main>
  );
}

function ToastView({ type }: { type: 'start' | 'focus-complete' }): ReactElement {
  const isFocusComplete = type === 'focus-complete';

  useEffect(() => {
    if (!isFocusComplete) {
      return;
    }

    const alarm = new Audio(focusCompleteAlarmUrl);
    alarm.loop = false;
    alarm.volume = 0.72;
    void alarm.play().catch(() => undefined);

    return () => {
      alarm.pause();
      alarm.currentTime = 0;
    };
  }, [isFocusComplete]);

  return (
    <main className="toast-window" onClick={() => void window.tomatoApi.hideToastWindow()}>
      <ToastStatusIcon type={isFocusComplete ? 'coffee' : 'clock'} />
      <div>
        <p>{isFocusComplete ? '专注结束' : '计时开始'}</p>
        <strong>{isFocusComplete ? '该休息啦' : '进入专注状态'}</strong>
      </div>
      <span className="toast-close">点击关闭</span>
    </main>
  );
}

function ToastStatusIcon({ type }: { type: 'clock' | 'coffee' }): ReactElement {
  if (type === 'clock') {
    return (
      <div className="toast-icon clock" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="7.25" />
          <path d="M12 7.8v4.5l3.2 2" />
        </svg>
      </div>
    );
  }

  return (
    <div className="toast-icon coffee" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M7.2 10.2h9.2v4.2a4.1 4.1 0 0 1-4.1 4.1h-1a4.1 4.1 0 0 1-4.1-4.1v-4.2Z" />
        <path d="M16.4 11.4h1.2a2.2 2.2 0 0 1 0 4.4h-1.2" />
        <path d="M6.4 20h11.2" />
        <path d="M9 4.3c-.8.8-.8 1.5 0 2.3" />
        <path d="M12 3.7c-.8.9-.8 1.7 0 2.6" />
        <path d="M15 4.3c-.8.8-.8 1.5 0 2.3" />
      </svg>
    </div>
  );
}

function TimerText({ seconds }: { seconds: number }): ReactElement {
  return <div className="timer-text">{formatSeconds(seconds)}</div>;
}

function WindowFrame({
  children
}: {
  title: string;
  lights: 'two' | 'three';
  children: ReactNode;
}): ReactElement {
  return (
    <article className="window-card">
      <div className="window-body">{children}</div>
    </article>
  );
}

function TomatoIcon({ large = false }: { large?: boolean }): ReactElement {
  return (
    <div className={large ? 'tomato-icon large' : 'tomato-icon'} aria-hidden="true">
      <span />
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }): ReactElement {
  return (
    <div className="stat-card">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
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

function detailStatusText(phase: TimerPhase): string {
  if (phase === 'focus') {
    return '专注';
  }

  if (phase === 'break') {
    return '休息';
  }

  return '未运行';
}

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element is missing.');
}

createRoot(root).render(<App />);
