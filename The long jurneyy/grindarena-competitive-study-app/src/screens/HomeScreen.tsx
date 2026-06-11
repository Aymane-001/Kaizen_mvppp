import { useStore } from '../store/useStore';
import { themes } from '../theme/themes';
import { Flame, Zap, ChevronRight, Shield, TrendingUp, Clock } from 'lucide-react';

const RANK_COLORS: Record<string, string> = {
  Bronze: '#cd7f32', Silver: '#c0c0c0', Gold: '#ffd700',
  Platinum: '#e5e4e2', Diamond: '#b9f2ff', Legend: '#ff6b35',
};

function XpBar({ xp, theme: t }: { xp: number; theme: any }) {
  const XP_LEVELS = [0, 500, 1200, 2500, 5000, 10000];
  const RANKS = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Legend'];
  let rankIdx = 0;
  for (let i = 0; i < XP_LEVELS.length; i++) { if (xp >= XP_LEVELS[i]) rankIdx = i; }
  const nextXp = XP_LEVELS[rankIdx + 1] ?? XP_LEVELS[rankIdx];
  const prevXp = XP_LEVELS[rankIdx];
  const pct = nextXp > prevXp ? Math.min(100, ((xp - prevXp) / (nextXp - prevXp)) * 100) : 100;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold" style={{ color: RANK_COLORS[RANKS[rankIdx]] }}>
          {RANKS[rankIdx]}
        </span>
        <span className="text-xs" style={{ color: t.textMuted }}>
          {xp} / {nextXp} XP
        </span>
      </div>
      <div className="h-2 rounded-full" style={{ background: t.border }}>
        <div
          className="h-2 rounded-full progress-bar"
          style={{ width: `${pct}%`, background: t.gradient }}
        />
      </div>
    </div>
  );
}

export default function HomeScreen() {
  const { theme, user, challenges, setScreen, acceptChallenge, declineChallenge } = useStore();
  const t = themes[theme];

  const quickBattleDurations = [25, 50, 90];

  return (
    <div className="h-full w-full flex flex-col" style={{ background: t.bg }}>
      {/* Header */}
      <div
        className="px-5 pt-12 pb-4"
        style={{ background: t.surface, borderBottom: `1px solid ${t.border}` }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium" style={{ color: t.textMuted }}>Welcome back,</p>
            <h1 className="text-2xl font-black" style={{ color: t.text }}>
              {user.name} {user.avatar}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {/* Streak */}
            <div
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl"
              style={{ background: t.pill }}
            >
              <Flame size={16} style={{ color: t.gold }} />
              <span className="text-sm font-bold" style={{ color: t.gold }}>{user.streak}</span>
            </div>
            {/* XP pill */}
            <div
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl"
              style={{ background: t.pill }}
            >
              <Zap size={14} style={{ color: t.primary }} />
              <span className="text-sm font-bold" style={{ color: t.primary }}>{user.xp}</span>
            </div>
          </div>
        </div>

        <XpBar xp={user.xp} theme={t} />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 scroll-y px-5 py-4 flex flex-col gap-5">

        {/* Rank decay warning */}
        <div
          className="anim-fadeIn rounded-2xl p-4 flex items-center gap-3"
          style={{ background: 'rgba(255,77,106,0.1)', border: '1px solid rgba(255,77,106,0.25)' }}
        >
          <TrendingUp size={20} color="#ff4d6a" />
          <div className="flex-1">
            <p className="text-sm font-bold text-red-400">Rank decays in 3 days</p>
            <p className="text-xs" style={{ color: t.textMuted }}>Battle now to protect your {user.rank} rank</p>
          </div>
          <button
            className="press-effect text-xs font-bold px-3 py-1.5 rounded-lg"
            style={{ background: '#ff4d6a22', color: '#ff4d6a' }}
            onClick={() => setScreen('challenges')}
          >
            Battle
          </button>
        </div>

        {/* Quick battle */}
        <div className="anim-slideUp anim-delay-1 flex flex-col gap-3">
          <h2 className="text-base font-bold" style={{ color: t.text }}>⚡ Quick Battle</h2>
          <div className="grid grid-cols-3 gap-3">
            {quickBattleDurations.map((mins) => (
              <button
                key={mins}
                className="press-effect rounded-2xl p-4 flex flex-col items-center gap-2"
                style={{ background: t.surface, border: `1px solid ${t.border}` }}
                onClick={() => setScreen('challenges')}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: t.cardGradient }}
                >
                  <Clock size={18} style={{ color: t.primary }} />
                </div>
                <span className="text-base font-black" style={{ color: t.text }}>{mins}<span className="text-xs font-medium">m</span></span>
                <span className="text-xs" style={{ color: t.textMuted }}>
                  {mins === 25 ? 'Pomodoro' : mins === 50 ? 'Deep Work' : 'Marathon'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Incoming challenges */}
        {challenges.length > 0 && (
          <div className="anim-slideUp anim-delay-2 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold" style={{ color: t.text }}>
                🔥 Incoming Challenges
              </h2>
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: t.loss + '22', color: t.loss }}
              >
                {challenges.length} waiting
              </span>
            </div>

            {challenges.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl p-4 flex flex-col gap-3"
                style={{ background: t.surface, border: `1px solid ${t.border}` }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl"
                    style={{ background: t.cardGradient }}
                  >
                    {c.fromAvatar}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold" style={{ color: t.text }}>{c.fromName}</span>
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ color: RANK_COLORS[c.fromRank], background: RANK_COLORS[c.fromRank] + '22' }}
                      >
                        {c.fromRank}
                      </span>
                    </div>
                    <p className="text-sm" style={{ color: t.textMuted }}>
                      {c.duration}min battle · expires in {c.expiresIn}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    className="press-effect flex-1 py-2.5 rounded-xl font-bold text-sm"
                    style={{ background: t.gradient, color: '#fff' }}
                    onClick={() => acceptChallenge(c.id)}
                  >
                    Accept ⚔️
                  </button>
                  <button
                    className="press-effect flex-1 py-2.5 rounded-xl font-bold text-sm"
                    style={{ background: t.border, color: t.textMuted }}
                    onClick={() => declineChallenge(c.id)}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Season progress */}
        <div
          className="anim-slideUp anim-delay-3 rounded-2xl p-4 flex flex-col gap-3"
          style={{ background: t.surface, border: `1px solid ${t.border}` }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield size={16} style={{ color: t.gold }} />
              <span className="font-bold text-sm" style={{ color: t.text }}>Season 1 · Week 6/16</span>
            </div>
            <button
              className="flex items-center gap-1 text-xs font-semibold"
              style={{ color: t.primary }}
              onClick={() => setScreen('leaderboard')}
            >
              Leaderboard <ChevronRight size={14} />
            </button>
          </div>

          <div className="h-2 rounded-full" style={{ background: t.border }}>
            <div
              className="h-2 rounded-full progress-bar"
              style={{ width: '37.5%', background: `linear-gradient(90deg, ${t.gold}, ${t.primary})` }}
            />
          </div>

          <div
            className="rounded-xl p-3 flex items-center gap-3"
            style={{ background: t.cardGradient }}
          >
            <span className="text-2xl">🏅</span>
            <div>
              <p className="text-sm font-bold" style={{ color: t.text }}>Season reward: LinkedIn Badge</p>
              <p className="text-xs" style={{ color: t.textMuted }}>Top 3 at AUI get a verified achievement</p>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="anim-slideUp anim-delay-4 grid grid-cols-3 gap-3">
          {[
            { label: 'Sessions', value: user.totalSessions, icon: '📚' },
            { label: 'Win Rate', value: `${Math.round((user.wins / Math.max(1, user.wins + user.losses)) * 100)}%`, icon: '🏆' },
            { label: 'Minutes', value: user.totalMinutes, icon: '⏱️' },
          ].map(({ label, value, icon }) => (
            <div
              key={label}
              className="rounded-2xl p-3 flex flex-col items-center gap-1"
              style={{ background: t.surface, border: `1px solid ${t.border}` }}
            >
              <span className="text-xl">{icon}</span>
              <span className="text-lg font-black" style={{ color: t.text }}>{value}</span>
              <span className="text-xs" style={{ color: t.textMuted }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Bottom spacing for nav */}
        <div className="h-4" />
      </div>
    </div>
  );
}
