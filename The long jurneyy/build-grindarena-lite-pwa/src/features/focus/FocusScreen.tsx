import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useStore, SessionDuration } from '../../lib/store';
import { getTheme } from '../../lib/theme';
import { ChallengesPanel } from './ChallengesPanel';
import { CheckCircle, Camera, CameraOff, Zap, Clock, Users } from 'lucide-react';

// ─── Manual Focus Check Modal ──────────────────────────────────────────────
function FocusCheckModal({ onConfirm, onTimeout, t }: {
  onConfirm: () => void;
  onTimeout: () => void;
  t: ReturnType<typeof getTheme>;
}) {
  const [remaining, setRemaining] = useState(5);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(interval);
          onTimeout();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onTimeout]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-6">
      <div className={`${t.bgCard} ${t.border} border rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl`}>
        <div className="text-5xl mb-4">👀</div>
        <h2 className={`text-2xl font-bold ${t.text} mb-2`}>Still focused?</h2>
        <p className={`${t.textMuted} mb-6`}>Tap within {remaining}s or XP pauses</p>
        <button
          onClick={onConfirm}
          className={`w-full py-4 rounded-xl font-bold text-lg ${t.accent} ${t.accentHover} ${t.textInverse} transition-all active:scale-95`}
        >
          ✓ Yes, I'm focused! ({remaining}s)
        </button>
      </div>
    </div>
  );
}

// ─── XP Ring ──────────────────────────────────────────────────────────────

const ACCENT_COLORS: Record<string, string> = {
  'bg-blue-600':    '#2563eb',
  'bg-emerald-600': '#059669',
  'bg-orange-600':  '#ea580c',
  'bg-rose-700':    '#be123c',
  'bg-violet-600':  '#7c3aed',
  'bg-gray-600':    '#4b5563',
};

function XPRing({ xp, multiplier, t }: {
  xp: number;
  multiplier: number;
  t: ReturnType<typeof getTheme>;
}) {
  const size = 200;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min((xp % 100) / 100, 1);
  const offset = circumference - progress * circumference;
  const accentStroke = ACCENT_COLORS[t.accent] ?? '#3b82f6';

  const multColor = multiplier >= 2 ? 'text-amber-400' :
    multiplier >= 1.5 ? 'text-orange-400' :
    multiplier >= 1.2 ? 'text-sky-400' : 'text-slate-400';

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute -rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(100,116,139,0.2)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={accentStroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000"
          style={{ opacity: xp > 0 ? 1 : 0.1 }}
        />
      </svg>
      <div className="relative text-center z-10">
        <div className={`text-4xl font-black ${t.accentText}`}>{Math.floor(xp)}</div>
        <div className={`text-xs ${t.textMuted} mt-1`}>XP</div>
        {multiplier > 1 && (
          <div className={`text-sm font-bold mt-1 ${multColor}`}>×{multiplier.toFixed(1)}</div>
        )}
      </div>
    </div>
  );
}

// ─── Camera Feed ──────────────────────────────────────────────────────────
function CameraFeed({ onFocusChange }: { onFocusChange: (focused: boolean) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState(false);

  useEffect(() => {
    let alive = true;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 320, height: 240 }
        });
        streamRef.current = stream;
        if (videoRef.current && alive) {
          videoRef.current.srcObject = stream;
        }

        // Simulate gaze detection (real impl would use MediaPipe)
        // Random "focus lost" events to simulate detection
        const interval = setInterval(() => {
          if (!alive) return;
          const focused = Math.random() > 0.15; // 85% focused
          onFocusChange(focused);
        }, 2000);

        return () => clearInterval(interval);
      } catch {
        setCameraError(true);
        onFocusChange(true); // fallback: assume focused
      }
    }

    startCamera();

    return () => {
      alive = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [onFocusChange]);

  if (cameraError) return null;

  return (
    <div className="relative rounded-xl overflow-hidden w-32 h-24 border border-slate-700">
      <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
      <div className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
    </div>
  );
}

// ─── Session Timer ─────────────────────────────────────────────────────────
function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ─── Main Focus Screen ─────────────────────────────────────────────────────
export function FocusScreen() {
  const {
    activeSession, startSession, endSession, tickSession,
    setFocusLost, resumeSession, dismissComebackBanner,
    showComebackBanner, showChallengeCompleted, dismissChallengeCompleted,
    themeColor, themeMode, studyRooms,
  } = useStore();
  const t = getTheme(themeColor, themeMode);

  const [elapsed, setElapsed] = useState(0);
  const [showFocusCheck, setShowFocusCheck] = useState(false);
  const [cameraMode, setCameraMode] = useState<'camera' | 'manual' | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const focusCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // How many people are "studying" now (simulated)
  const totalInRooms = studyRooms.reduce((a, r) => a + r.participants.length, 0);
  const activeStudying = totalInRooms + Math.floor(Math.random() * 4) + 2;

  // ── Tick Effect ──
  useEffect(() => {
    if (activeSession?.running) {
      tickRef.current = setInterval(() => {
        tickSession();
        setElapsed((e) => e + 1);
      }, 1000);
    } else {
      if (tickRef.current) clearInterval(tickRef.current);
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [activeSession?.running, tickSession]);

  // ── Manual focus checks ──
  const scheduleFocusCheck = useCallback(() => {
    if (focusCheckRef.current) clearTimeout(focusCheckRef.current);
    const delay = (Math.floor(Math.random() * 3) + 2) * 60 * 1000; // 2–5 min
    focusCheckRef.current = setTimeout(() => {
      setShowFocusCheck(true);
    }, delay);
  }, []);

  useEffect(() => {
    if (activeSession?.running && activeSession.mode === 'manual') {
      scheduleFocusCheck();
    }
    return () => {
      if (focusCheckRef.current) clearTimeout(focusCheckRef.current);
    };
  }, [activeSession?.running, activeSession?.mode, scheduleFocusCheck]);

  // ── Auto-end session if duration reached ──
  useEffect(() => {
    if (!activeSession) { setElapsed(0); return; }
    if (activeSession.targetDuration && elapsed >= activeSession.targetDuration * 60) {
      endSession();
    }
  }, [elapsed, activeSession, endSession]);

  const handleStart = (mode: 'camera' | 'manual', duration: SessionDuration) => {
    setCameraMode(mode);
    startSession(mode, duration);
  };

  const handleCameraFocusChange = (focused: boolean) => {
    setFocusLost(!focused);
  };

  const handleFocusCheckConfirm = () => {
    setShowFocusCheck(false);
    setFocusLost(false);
    resumeSession();
    scheduleFocusCheck();
  };

  const handleFocusCheckTimeout = () => {
    setShowFocusCheck(false);
    setFocusLost(true);
  };

  const totalTarget = activeSession?.targetDuration ? activeSession.targetDuration * 60 : null;
  const progressPct = totalTarget ? Math.min((elapsed / totalTarget) * 100, 100) : null;
  const isFocusLost = activeSession?.focusLostAt != null;

  return (
    <div className={`flex flex-col min-h-screen ${t.bg} pb-20`}>
      {/* Comeback Banner */}
      {showComebackBanner && (
        <div className="fixed top-0 left-0 right-0 z-40 bg-amber-500 text-amber-950 px-4 py-3 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <Zap size={18} className="shrink-0" />
            <span className="font-bold text-sm">Welcome back — +50% XP boost active!</span>
          </div>
          <button onClick={dismissComebackBanner} className="text-amber-900 font-bold text-lg leading-none">×</button>
        </div>
      )}

      {/* Challenge Completed Toast */}
      {showChallengeCompleted && (
        <div className="fixed top-14 left-0 right-0 z-40 mx-4">
          <div className={`${t.bgCard} border ${t.border} rounded-xl px-4 py-3 flex items-center gap-3 shadow-xl`}>
            <CheckCircle size={20} className="text-emerald-400 shrink-0" />
            <div>
              <div className={`font-bold text-sm ${t.text}`}>Challenge Complete!</div>
              <div className={`text-xs ${t.textMuted}`}>{showChallengeCompleted}</div>
            </div>
            <button onClick={dismissChallengeCompleted} className={`ml-auto ${t.textMuted}`}>×</button>
          </div>
        </div>
      )}

      {/* Focus Check Modal */}
      {showFocusCheck && (
        <FocusCheckModal
          onConfirm={handleFocusCheckConfirm}
          onTimeout={handleFocusCheckTimeout}
          t={t}
        />
      )}

      {/* Social Presence */}
      <div className={`flex items-center justify-center gap-2 pt-4 pb-2`}>
        <div className="flex -space-x-1">
          {[...Array(Math.min(activeStudying, 5))].map((_, i) => (
            <div key={i} className={`w-5 h-5 rounded-full ${t.accentLight} border ${t.border} flex items-center justify-center text-[8px] ${t.accentText}`}>
              {String.fromCharCode(65 + i)}
            </div>
          ))}
        </div>
        <span className={`text-xs ${t.textMuted}`}>
          <Users size={11} className="inline mr-1" />
          {activeStudying} studying now
        </span>
      </div>

      {!activeSession ? (
        /* ── Pre-session UI ── */
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
          <div className="text-center mb-2">
            <h1 className={`text-3xl font-black ${t.text}`}>GrindArena</h1>
            <p className={`text-sm ${t.textMuted} mt-1`}>Focus. Earn. Dominate.</p>
          </div>

          {/* Quick Start — Primary CTA */}
          <button
            onClick={() => handleStart('manual', 25)}
            className={`w-full max-w-xs py-5 rounded-2xl font-black text-xl ${t.accent} ${t.accentHover} ${t.textInverse} shadow-lg transition-all active:scale-95`}
          >
            ▶ Start 25 min session
          </button>

          {/* Mode Toggle */}
          <div className={`flex gap-3 ${t.bgCard} p-1 rounded-xl border ${t.border}`}>
            <button
              onClick={() => setCameraMode('camera')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${cameraMode === 'camera' ? `${t.accent} ${t.textInverse}` : `${t.textMuted}`}`}
            >
              <Camera size={15} /> Camera
            </button>
            <button
              onClick={() => setCameraMode('manual')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${cameraMode !== 'camera' ? `${t.accent} ${t.textInverse}` : `${t.textMuted}`}`}
            >
              <CameraOff size={15} /> Manual
            </button>
          </div>

          {/* Duration options */}
          <div className="w-full max-w-xs">
            <p className={`text-xs ${t.textMuted} text-center mb-3`}>Other durations</p>
            <div className="grid grid-cols-2 gap-3">
              {([50, 120] as SessionDuration[]).map((d) => (
                <button
                  key={d}
                  onClick={() => handleStart(cameraMode === 'camera' ? 'camera' : 'manual', d)}
                  className={`py-4 rounded-xl font-bold text-base ${t.bgCard} ${t.border} border ${t.text} ${t.accentHover} transition-all active:scale-95`}
                >
                  <Clock size={14} className="inline mr-1 mb-0.5" />
                  {d} min
                </button>
              ))}
            </div>
          </div>

          {/* Challenges */}
          <ChallengesPanel t={t} compact />
        </div>
      ) : (
        /* ── Active Session UI ── */
        <div className="flex-1 flex flex-col items-center justify-between px-6 py-4">

          {/* Timer & Mode */}
          <div className="w-full flex items-center justify-between">
            <div className={`px-3 py-1 rounded-full text-xs font-semibold ${t.accentLight} ${t.accentText}`}>
              {activeSession.mode === 'camera' ? '📷 Camera' : '⌨️ Manual'}
            </div>
            {activeSession.targetDuration && (
              <div className={`text-xs ${t.textMuted}`}>
                {activeSession.targetDuration} min
              </div>
            )}
            <div className={`text-sm font-mono font-bold ${t.text}`}>
              {formatTime(elapsed)}
            </div>
          </div>

          {/* Progress Bar */}
          {progressPct !== null && (
            <div className={`w-full h-1.5 ${t.bgInput} rounded-full mt-2 overflow-hidden`}>
              <div
                className={`h-full ${t.xpBar} rounded-full transition-all duration-1000`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}

          {/* Camera Feed */}
          {activeSession.mode === 'camera' && (
            <div className="mt-2">
              <CameraFeed onFocusChange={handleCameraFocusChange} />
            </div>
          )}

          {/* XP Ring */}
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <XPRing xp={activeSession.xp} multiplier={activeSession.multiplier} t={t} />

            {/* Focus Status */}
            {isFocusLost ? (
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-amber-400 bg-amber-900/30`}>
                ⏸ XP paused — look at screen
              </div>
            ) : (
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${t.accentLight} ${t.accentText}`}>
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Earning XP...
              </div>
            )}

            {/* Comeback Bonus */}
            {activeSession.comebackBonusActive && (
              <div className="flex items-center gap-1 text-xs text-amber-400">
                <Zap size={12} /> +50% comeback bonus
              </div>
            )}
          </div>

          {/* End Session */}
          <button
            onClick={endSession}
            className={`w-full max-w-xs py-4 rounded-2xl font-bold text-base ${t.bgCard} ${t.border} border ${t.textMuted} hover:${t.danger} transition-all active:scale-95`}
          >
            End Session
          </button>
        </div>
      )}
    </div>
  );
}
