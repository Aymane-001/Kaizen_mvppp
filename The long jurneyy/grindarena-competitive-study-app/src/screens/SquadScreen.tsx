import { useStore } from '../store/useStore';
import { themes } from '../theme/themes';
import { Users, Zap, Wifi, WifiOff, Shield } from 'lucide-react';

const RANK_COLORS: Record<string, string> = {
  Bronze: '#cd7f32', Silver: '#c0c0c0', Gold: '#ffd700',
  Platinum: '#e5e4e2', Diamond: '#b9f2ff', Legend: '#ff6b35',
};

export default function SquadScreen() {
  const { theme, squad, user, setScreen } = useStore();
  const t = themes[theme];

  const totalXp = squad.reduce((s, m) => s + m.xp, 0) + user.xp;
  const onlineCount = squad.filter(m => m.isOnline).length + 1; // +1 for self

  const upcomingBattle = {
    vs: 'Team Thunder ⚡',
    time: 'Tomorrow · 8PM',
    type: 'Squad Battle',
  };

  return (
    <div className="h-full w-full flex flex-col" style={{ background: t.bg }}>
      {/* Header */}
      <div
        className="px-5 pt-12 pb-5"
        style={{ background: t.surface, borderBottom: `1px solid ${t.border}` }}
      >
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-black" style={{ color: t.text }}>🛡️ Squad</h1>
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
            style={{ background: t.pill }}
          >
            <div className="w-2 h-2 rounded-full" style={{ background: t.win, boxShadow: `0 0 6px ${t.win}` }} />
            <span className="text-xs font-bold" style={{ color: t.win }}>{onlineCount} online</span>
          </div>
        </div>

        {/* Squad name & stats */}
        <div
          className="rounded-2xl p-4 flex flex-col gap-3"
          style={{ background: t.cardGradient, border: `1px solid ${t.border}` }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
              style={{ background: t.gradient }}
            >
              🔥
            </div>
            <div>
              <p className="text-lg font-black" style={{ color: t.text }}>Team Grind 🔥</p>
              <p className="text-xs" style={{ color: t.textMuted }}>AUI · 4 members</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Team XP', value: totalXp.toLocaleString(), icon: <Zap size={14} /> },
              { label: 'Wins', value: '18', icon: <Shield size={14} /> },
              { label: 'Rank', value: 'Platinum', icon: '🏆' },
            ].map(({ label, value, icon }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1 rounded-xl py-2"
                style={{ background: t.surface }}
              >
                <span style={{ color: t.primary }}>{icon}</span>
                <span className="text-sm font-black" style={{ color: t.text }}>{value}</span>
                <span className="text-xs" style={{ color: t.textMuted }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 scroll-y px-5 py-4 flex flex-col gap-4">

        {/* Upcoming battle */}
        <div
          className="anim-fadeIn rounded-2xl p-4 flex flex-col gap-3"
          style={{ background: t.surface, border: `1px solid ${t.border}` }}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold" style={{ color: t.text }}>⚔️ Upcoming Squad Battle</span>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: t.primary + '22', color: t.primary }}
            >
              {upcomingBattle.type}
            </span>
          </div>
          <div
            className="rounded-xl p-3 flex items-center justify-between"
            style={{ background: t.cardGradient }}
          >
            <div>
              <p className="font-bold" style={{ color: t.text }}>vs {upcomingBattle.vs}</p>
              <p className="text-xs mt-0.5" style={{ color: t.textMuted }}>{upcomingBattle.time}</p>
            </div>
            <button
              className="press-effect px-4 py-2 rounded-xl text-sm font-bold"
              style={{ background: t.gradient, color: '#fff' }}
              onClick={() => setScreen('challenges')}
            >
              Ready
            </button>
          </div>
          <div
            className="rounded-xl p-3 flex items-start gap-2"
            style={{ background: 'rgba(255,77,106,0.08)', border: '1px solid rgba(255,77,106,0.2)' }}
          >
            <span className="text-base">⚠️</span>
            <p className="text-xs leading-relaxed" style={{ color: '#ff4d6a' }}>
              If you miss this battle, your squad loses 40 XP each. They'll know.
            </p>
          </div>
        </div>

        {/* Members */}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold" style={{ color: t.textMuted }}>MEMBERS</p>

          {/* Yourself */}
          <div
            className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background: t.pill, border: `1px solid ${t.primary}` }}
          >
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl"
              style={{ background: t.cardGradient }}
            >
              {user.avatar}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm" style={{ color: t.primary }}>{user.name} (You)</span>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ color: RANK_COLORS[user.rank], background: RANK_COLORS[user.rank] + '22' }}
                >
                  {user.rank}
                </span>
              </div>
              <p className="text-xs" style={{ color: t.textMuted }}>{user.xp.toLocaleString()} XP</p>
            </div>
            <div className="flex items-center gap-1">
              <Wifi size={14} style={{ color: t.win }} />
              <span className="text-xs font-bold" style={{ color: t.win }}>Online</span>
            </div>
          </div>

          {squad.map((member) => (
            <div
              key={member.id}
              className="anim-slideIn rounded-2xl p-4 flex items-center gap-3"
              style={{ background: t.surface, border: `1px solid ${t.border}` }}
            >
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl"
                style={{ background: t.cardGradient }}
              >
                {member.avatar}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm" style={{ color: t.text }}>{member.name}</span>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ color: RANK_COLORS[member.rank], background: RANK_COLORS[member.rank] + '22' }}
                  >
                    {member.rank}
                  </span>
                </div>
                <p className="text-xs" style={{ color: t.textMuted }}>
                  @{member.username} · {member.xp.toLocaleString()} XP
                </p>
              </div>
              <div className="flex items-center gap-1">
                {member.isOnline ? (
                  <>
                    <Wifi size={14} style={{ color: t.win }} />
                    <span className="text-xs font-bold" style={{ color: t.win }}>Online</span>
                  </>
                ) : (
                  <>
                    <WifiOff size={14} style={{ color: t.textMuted }} />
                    <span className="text-xs font-bold" style={{ color: t.textMuted }}>Away</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Invite */}
        <button
          className="press-effect w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2"
          style={{ background: t.cardGradient, border: `2px dashed ${t.border}`, color: t.primary }}
        >
          <Users size={18} />
          Invite a Classmate
        </button>

        <div className="h-4" />
      </div>
    </div>
  );
}
