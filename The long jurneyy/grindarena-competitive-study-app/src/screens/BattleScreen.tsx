import { useEffect, useState, useRef } from 'react';
import { useStore } from '../store/useStore';
import { themes } from '../theme/themes';
import { X, Zap } from 'lucide-react';

const RANK_COLORS: Record<string, string> = {
  Bronze: '#cd7f32', Silver: '#c0c0c0', Gold: '#ffd700',
  Platinum: '#e5e4e2', Diamond: '#b9f2ff', Legend: '#ff6b35',
};

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function BattleScreen() {
  const { theme, currentBattle, battleTimer, battleActive, tickBattle, endBattle, updateMyScore, setScreen, user } = useStore();
  const t = themes[theme];
  const [myScore, setMyScore] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<'win' | 'loss' | 'draw' | null>(null);
  const [focusClicks, setFocusClicks] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scoreRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalTime = (currentBattle?.duration ?? 25) * 60;

  useEffect(() => {
    if (!battleActive || showResult) return;
    intervalRef.current = setInterval(() => {
      tickBattle();
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [battleActive, showResult, tickBattle]);

  // Auto-increase score when focus mode is on
  useEffect(() => {
    if (!focusMode || showResult) return;
    scoreRef.current = setInterval(() => {
      setMyScore(prev => {
        const next = Math.min(100, prev + (Math.random() > 0.3 ? 2 : 1));
        updateMyScore(next);
        return next;
      });
    }, 1500);
    return () => { if (scoreRef.current) clearInterval(scoreRef.current); };
  }, [focusMode, showResult, updateMyScore]);

  // Score decreases when focus is off
  useEffect(() => {
    if (focusMode || showResult || myScore === 0) return;
    const drain = setInterval(() => {
      setMyScore(prev => Math.max(0, prev - 1));
    }, 2000);
    return () => clearInterval(drain);
  }, [focusMode, showResult, myScore]);

  // End battle when timer hits 0
  useEffect(() => {
    if (battleTimer === 0 && !showResult && currentBattle) {
      const opp = currentBattle.opponentScore;
      const me = myScore;
      const res: 'win' | 'loss' | 'draw' = me > opp ? 'win' : me < opp ? 'loss' : 'draw';
      setResult(res);
      setShowResult(true);
      endBattle(res);
    }
  }, [battleTimer, showResult, currentBattle, myScore, endBattle]);

  if (!currentBattle) return null;

  const timerPct = battleTimer / totalTime;
  const circumference = 2 * Math.PI * 54;
  const strokeDash = circumference * timerPct;

  const oppScore = currentBattle.opponentScore;

  if (showResult && result) {
    const xpMap = { win: 120, draw: 40, loss: 15 };
    return (
      <div
        className="h-full w-full flex flex-col items-center justify-center px-6 gap-6"
        style={{ background: t.bg }}
      >
        {/* Result emoji */}
        <div className="anim-bounceIn flex flex-col items-center gap-4">
          <div className="text-7xl">{result === 'win' ? '🏆' : result === 'loss' ? '💀' : '🤝'}</div>
          <h1
            className="text-5xl font-black"
            style={{ color: result === 'win' ? t.win : result === 'loss' ? t.loss : t.textMuted }}
          >
            {result === 'win' ? 'Victory!' : result === 'loss' ? 'Defeated' : 'Draw!'}
          </h1>
        </div>

        {/* Scores */}
        <div
          className="anim-fadeIn anim-delay-1 w-full rounded-3xl p-5 flex flex-col gap-4"
          style={{ background: t.surface, border: `1px solid ${t.border}` }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{user.avatar}</span>
              <div>
                <p className="font-bold" style={{ color: t.text }}>{user.name}</p>
                <p className="text-xs" style={{ color: t.textMuted }}>You</p>
              </div>
            </div>
            <span className="text-3xl font-black" style={{ color: result === 'win' ? t.win : t.text }}>
              {myScore}
            </span>
          </div>

          <div className="flex items-center justify-center">
            <span className="text-sm font-bold" style={{ color: t.textMuted }}>VS</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{currentBattle.opponentAvatar}</span>
              <div>
                <p className="font-bold" style={{ color: t.text }}>{currentBattle.opponentName}</p>
                <p className="text-xs" style={{ color: t.textMuted }}>{currentBattle.opponentUsername}</p>
              </div>
            </div>
            <span className="text-3xl font-black" style={{ color: result === 'loss' ? t.win : t.text }}>
              {Math.round(oppScore)}
            </span>
          </div>
        </div>

        {/* XP earned */}
        <div
          className="anim-slideUp anim-delay-2 flex items-center gap-2 px-6 py-3 rounded-2xl"
          style={{ background: t.pill }}
        >
          <Zap size={20} style={{ color: t.primary }} />
          <span className="text-lg font-black" style={{ color: t.primary }}>
            +{xpMap[result]} XP
          </span>
          <span className="text-sm" style={{ color: t.textMuted }}>earned</span>
        </div>

        <button
          className="press-effect anim-slideUp anim-delay-3 w-full py-4 rounded-2xl font-bold text-lg"
          style={{ background: t.gradient, color: '#fff', boxShadow: `0 8px 30px ${t.primaryGlow}` }}
          onClick={() => setScreen('home')}
        >
          Back to Arena
        </button>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col" style={{ background: t.bg }}>
      {/* Header */}
      <div
        className="px-5 pt-12 pb-4 flex items-center justify-between"
        style={{ borderBottom: `1px solid ${t.border}` }}
      >
        <div>
          <p className="text-xs font-semibold" style={{ color: t.textMuted }}>LIVE BATTLE</p>
          <h2 className="text-lg font-bold" style={{ color: t.text }}>
            vs {currentBattle.opponentName}
          </h2>
        </div>
        <button
          className="press-effect w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: t.surface, border: `1px solid ${t.border}` }}
          onClick={() => {
            endBattle('loss');
            setScreen('home');
          }}
        >
          <X size={18} style={{ color: t.textMuted }} />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center px-5 pt-6 gap-6 scroll-y">
        {/* Timer ring */}
        <div className="relative flex items-center justify-center">
          <svg width="140" height="140" viewBox="0 0 140 140">
            {/* Background ring */}
            <circle cx="70" cy="70" r="54" fill="none" stroke={t.border} strokeWidth="8" />
            {/* Progress ring */}
            <circle
              cx="70" cy="70" r="54"
              fill="none"
              stroke={t.primary}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${strokeDash} ${circumference}`}
              className="timer-ring"
              style={{
                filter: `drop-shadow(0 0 8px ${t.primaryGlow})`,
                transform: 'rotate(-90deg)',
                transformOrigin: 'center',
              }}
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-3xl font-black tabular-nums" style={{ color: t.text }}>
              {formatTime(battleTimer)}
            </span>
            <span className="text-xs" style={{ color: t.textMuted }}>remaining</span>
          </div>
        </div>

        {/* Score bars */}
        <div
          className="w-full rounded-2xl p-4 flex flex-col gap-4"
          style={{ background: t.surface, border: `1px solid ${t.border}` }}
        >
          {/* Lead indicator */}
          <div className="flex items-center justify-center">
            {myScore > oppScore ? (
              <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: t.win + '22', color: t.win }}>
                🟢 You're leading
              </span>
            ) : myScore < oppScore ? (
              <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: t.loss + '22', color: t.loss }}>
                🔴 Opponent is ahead
              </span>
            ) : (
              <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: t.border, color: t.textMuted }}>
                ⚡ Tied
              </span>
            )}
          </div>

          {/* You */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{user.avatar}</span>
                <span className="text-sm font-bold" style={{ color: t.text }}>You</span>
              </div>
              <span className="text-xl font-black" style={{ color: t.primary }}>{Math.round(myScore)}</span>
            </div>
            <div className="h-3 rounded-full" style={{ background: t.border }}>
              <div
                className="h-3 rounded-full score-bar"
                style={{ width: `${myScore}%`, background: t.gradient }}
              />
            </div>
          </div>

          {/* Opponent */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{currentBattle.opponentAvatar}</span>
                <div>
                  <span className="text-sm font-bold" style={{ color: t.text }}>{currentBattle.opponentName}</span>
                  <span
                    className="ml-2 text-xs font-bold px-1.5 py-0.5 rounded-full"
                    style={{ color: RANK_COLORS[currentBattle.opponentRank], background: RANK_COLORS[currentBattle.opponentRank] + '22' }}
                  >
                    {currentBattle.opponentRank}
                  </span>
                </div>
              </div>
              <span className="text-xl font-black" style={{ color: t.textMuted }}>{Math.round(oppScore)}</span>
            </div>
            <div className="h-3 rounded-full" style={{ background: t.border }}>
              <div
                className="h-3 rounded-full score-bar"
                style={{ width: `${oppScore}%`, background: `linear-gradient(90deg, ${t.loss}, #ff8c42)` }}
              />
            </div>
          </div>
        </div>

        {/* Focus button */}
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm font-medium" style={{ color: t.textMuted }}>
            {focusMode ? '🟢 Focus mode ON — your score is rising' : 'Tap and hold to focus'}
          </p>
          <button
            className="w-48 h-48 rounded-full flex flex-col items-center justify-center gap-2 transition-all duration-200"
            style={{
              background: focusMode ? t.gradient : t.surface,
              border: `3px solid ${focusMode ? t.primary : t.border}`,
              boxShadow: focusMode ? `0 0 50px ${t.primaryGlow}, 0 0 100px ${t.primaryGlow}40` : 'none',
              transform: focusMode ? 'scale(1.05)' : 'scale(1)',
            }}
            onPointerDown={() => { setFocusMode(true); setFocusClicks(c => c + 1); }}
            onPointerUp={() => setFocusMode(false)}
            onPointerLeave={() => setFocusMode(false)}
          >
            <span className="text-4xl">{focusMode ? '🔥' : '⚡'}</span>
            <span className="text-sm font-bold" style={{ color: focusMode ? '#fff' : t.textMuted }}>
              {focusMode ? 'FOCUSING' : 'FOCUS'}
            </span>
            {focusClicks > 0 && (
              <span className="text-xs" style={{ color: focusMode ? 'rgba(255,255,255,0.7)' : t.textMuted }}>
                {focusClicks} taps
              </span>
            )}
          </button>
        </div>

        {/* End early */}
        <button
          className="press-effect py-3 px-8 rounded-2xl text-sm font-semibold mb-4"
          style={{ background: t.surface, border: `1px solid ${t.border}`, color: t.textMuted }}
          onClick={() => {
            const res: 'win' | 'loss' | 'draw' = myScore > oppScore ? 'win' : myScore < oppScore ? 'loss' : 'draw';
            setResult(res);
            setShowResult(true);
            endBattle(res);
          }}
        >
          Finish Early
        </button>
      </div>
    </div>
  );
}
