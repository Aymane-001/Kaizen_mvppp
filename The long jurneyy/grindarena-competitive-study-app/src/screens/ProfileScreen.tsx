import { useStore } from '../store/useStore';
import { themes } from '../theme/themes';
import { Settings, Flame, Zap, Swords } from 'lucide-react';

const RANK_COLORS: Record<string, string> = {
  Bronze: '#cd7f32', Silver: '#c0c0c0', Gold: '#ffd700',
  Platinum: '#e5e4e2', Diamond: '#b9f2ff', Legend: '#ff6b35',
};

const XP_LEVELS = [0, 500, 1200, 2500, 5000, 10000];
const RANKS = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Legend'];

export default function ProfileScreen() {
  const { theme, user, setScreen } = useStore();
  const t = themes[theme];

  let rankIdx = 0;
  for (let i = 0; i < XP_LEVELS.length; i++) { if (user.xp >= XP_LEVELS[i]) rankIdx = i; }
  const nextXp = XP_LEVELS[rankIdx + 1] ?? user.xp;
  const prevXp = XP_LEVELS[rankIdx];
  const pct = nextXp > prevXp ? Math.min(100, ((user.xp - prevXp) / (nextXp - prevXp)) * 100) : 100;
  const xpToNext = nextXp - user.xp;

  const winRate = Math.round((user.wins / Math.max(1, user.wins + user.losses)) * 100);

  return (
    <div className="h-full w-full flex flex-col" style={{ background: t.bg }}>
      {/* Header */}
      <div
        className="px-5 pt-12 pb-5"
        style={{ background: t.surface, borderBottom: `1px solid ${t.border}` }}
      >
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-black" style={{ color: t.text }}>Profile</h1>
          <button
            className="press-effect w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: t.border }}
            onClick={() => setScreen('settings')}
          >
            <Settings size={20} style={{ color: t.textMuted }} />
          </button>
        </div>

        {/* Avatar + info */}
        <div className="flex items-center gap-4">
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl"
            style={{
              background: t.gradient,
              boxShadow: `0 0 30px ${t.primaryGlow}`,
            }}
          >
            {user.avatar}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-black" style={{ color: t.text }}>{user.name}</h2>
            <p className="text-sm" style={{ color: t.textMuted }}>@{user.username} · {user.university}</p>
            <div className="flex items-center gap-3 mt-2">
              <div
                className="flex items-center gap-1 px-2 py-1 rounded-lg"
                style={{ background: RANK_COLORS[user.rank] + '22' }}
              >
                <span className="text-xs font-bold" style={{ color: RANK_COLORS[user.rank] }}>
                  {user.rank}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Flame size={14} style={{ color: t.gold }} />
                <span className="text-sm font-bold" style={{ color: t.gold }}>{user.streak} day streak</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 scroll-y px-5 py-4 flex flex-col gap-4">

        {/* XP progress */}
        <div
          className="anim-fadeIn rounded-2xl p-4 flex flex-col gap-3"
          style={{ background: t.surface, border: `1px solid ${t.border}` }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={16} style={{ color: t.primary }} />
              <span className="font-bold text-sm" style={{ color: t.text }}>Rank Progress</span>
            </div>
            <span className="text-sm font-black" style={{ color: t.primary }}>
              {user.xp} XP
            </span>
          </div>

          <div className="h-3 rounded-full" style={{ background: t.border }}>
            <div
              className="h-3 rounded-full progress-bar"
              style={{ width: `${pct}%`, background: t.gradient }}
            />
          </div>

          <div className="flex items-center justify-between text-xs" style={{ color: t.textMuted }}>
            <span style={{ color: RANK_COLORS[RANKS[rankIdx]] }}>{RANKS[rankIdx]}</span>
            <span>{rankIdx < RANKS.length - 1 ? `${xpToNext} XP to ${RANKS[rankIdx + 1]}` : '🏆 Max Rank!'}</span>
            {rankIdx < RANKS.length - 1 && (
              <span style={{ color: RANK_COLORS[RANKS[rankIdx + 1]] }}>{RANKS[rankIdx + 1]}</span>
            )}
          </div>

          {/* Decay warning */}
          <div
            className="rounded-xl p-2.5 flex items-center gap-2"
            style={{ background: 'rgba(255,77,106,0.08)' }}
          >
            <span className="text-sm">⏳</span>
            <p className="text-xs" style={{ color: '#ff4d6a' }}>
              Rank decays −50 XP in 3 days without a battle
            </p>
          </div>
        </div>

        {/* Stats grid */}
        <div className="anim-slideUp anim-delay-1 grid grid-cols-2 gap-3">
          {[
            { label: 'Total Sessions', value: user.totalSessions, icon: '📚', color: t.primary },
            { label: 'Win Rate', value: `${winRate}%`, icon: '🏆', color: t.win },
            { label: 'Total Wins', value: user.wins, icon: '⚔️', color: t.gold },
            { label: 'Mins Focused', value: user.totalMinutes.toLocaleString(), icon: '⏱️', color: t.secondary },
          ].map(({ label, value, icon, color }) => (
            <div
              key={label}
              className="rounded-2xl p-4 flex flex-col gap-2"
              style={{ background: t.surface, border: `1px solid ${t.border}` }}
            >
              <span className="text-2xl">{icon}</span>
              <span className="text-2xl font-black" style={{ color }}>{value}</span>
              <span className="text-xs" style={{ color: t.textMuted }}>{label}</span>
            </div>
          ))}
        </div>

        {/* W/L bar */}
        <div
          className="anim-slideUp anim-delay-2 rounded-2xl p-4 flex flex-col gap-3"
          style={{ background: t.surface, border: `1px solid ${t.border}` }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Swords size={16} style={{ color: t.textMuted }} />
              <span className="text-sm font-bold" style={{ color: t.text }}>Battle Record</span>
            </div>
            <span className="text-sm font-bold" style={{ color: t.textMuted }}>
              {user.wins}W · {user.losses}L
            </span>
          </div>
          <div className="flex rounded-full overflow-hidden h-4">
            <div
              className="h-4 transition-all duration-700"
              style={{ width: `${winRate}%`, background: t.win }}
            />
            <div
              className="h-4 transition-all duration-700 flex-1"
              style={{ background: t.loss }}
            />
          </div>
          <div className="flex justify-between text-xs">
            <span style={{ color: t.win }}>Wins {winRate}%</span>
            <span style={{ color: t.loss }}>Losses {100 - winRate}%</span>
          </div>
        </div>

        {/* Badges */}
        <div className="anim-slideUp anim-delay-3 flex flex-col gap-3">
          <p className="text-sm font-bold" style={{ color: t.textMuted }}>BADGES</p>
          <div className="flex flex-col gap-2">
            {user.badges.map((badge) => (
              <div
                key={badge}
                className="rounded-2xl px-4 py-3 flex items-center gap-3"
                style={{ background: t.surface, border: `1px solid ${t.border}` }}
              >
                <span className="text-xl">{badge.split(' ')[0]}</span>
                <span className="text-sm font-semibold" style={{ color: t.text }}>
                  {badge.split(' ').slice(1).join(' ')}
                </span>
              </div>
            ))}
            {/* Locked badges */}
            {['💎 Diamond Grinder', '🌍 University Champion', '🔮 Legend'].map((badge) => (
              <div
                key={badge}
                className="rounded-2xl px-4 py-3 flex items-center gap-3 opacity-40"
                style={{ background: t.surface, border: `1px dashed ${t.border}` }}
              >
                <span className="text-xl">🔒</span>
                <span className="text-sm font-semibold" style={{ color: t.textMuted }}>
                  {badge.split(' ').slice(1).join(' ')}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="h-4" />
      </div>
    </div>
  );
}
