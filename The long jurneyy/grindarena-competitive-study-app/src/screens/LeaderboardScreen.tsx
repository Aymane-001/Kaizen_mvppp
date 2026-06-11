import { useState } from 'react';
import { useStore } from '../store/useStore';
import { themes } from '../theme/themes';
import { Flame, Trophy } from 'lucide-react';

const RANK_COLORS: Record<string, string> = {
  Bronze: '#cd7f32', Silver: '#c0c0c0', Gold: '#ffd700',
  Platinum: '#e5e4e2', Diamond: '#b9f2ff', Legend: '#ff6b35',
};

const POSITION_COLORS = ['#ffd700', '#c0c0c0', '#cd7f32'];

const universities = ['All', 'AUI', 'ENSIAS', 'ENSA'];

export default function LeaderboardScreen() {
  const { theme, leaderboard } = useStore();
  const t = themes[theme];
  const [filter, setFilter] = useState('All');
  const [tab, setTab] = useState<'global' | 'university'>('global');

  const filtered = leaderboard.filter(e =>
    filter === 'All' || e.university === filter
  );

  const myEntry = leaderboard.find(e => e.isMe);

  return (
    <div className="h-full w-full flex flex-col" style={{ background: t.bg }}>
      {/* Header */}
      <div
        className="px-5 pt-12 pb-4 flex flex-col gap-4"
        style={{ background: t.surface, borderBottom: `1px solid ${t.border}` }}
      >
        <h1 className="text-2xl font-black" style={{ color: t.text }}>🏆 Leaderboard</h1>

        {/* Tabs */}
        <div className="flex rounded-xl p-1" style={{ background: t.bg }}>
          {(['global', 'university'] as const).map((tab_opt) => (
            <button
              key={tab_opt}
              className="press-effect flex-1 py-2 rounded-lg text-sm font-bold"
              style={{
                background: tab === tab_opt ? t.gradient : 'transparent',
                color: tab === tab_opt ? '#fff' : t.textMuted,
              }}
              onClick={() => setTab(tab_opt)}
            >
              {tab_opt === 'global' ? 'Global' : 'University'}
            </button>
          ))}
        </div>

        {/* University filter */}
        {tab === 'university' && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {universities.map((u) => (
              <button
                key={u}
                className="press-effect flex-shrink-0 px-4 py-1.5 rounded-xl text-sm font-bold"
                style={{
                  background: filter === u ? t.gradient : t.border,
                  color: filter === u ? '#fff' : t.textMuted,
                }}
                onClick={() => setFilter(u)}
              >
                {u}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Season info */}
      <div
        className="mx-5 mt-4 rounded-2xl p-3 flex items-center gap-3"
        style={{ background: t.cardGradient, border: `1px solid ${t.border}` }}
      >
        <span className="text-2xl">🏅</span>
        <div className="flex-1">
          <p className="text-sm font-bold" style={{ color: t.text }}>Season 1 ends in 10 weeks</p>
          <p className="text-xs" style={{ color: t.textMuted }}>Top 3 earn a LinkedIn achievement badge</p>
        </div>
        <Trophy size={18} style={{ color: t.gold }} />
      </div>

      {/* My position sticky card */}
      {myEntry && (
        <div className="px-5 mt-3">
          <div
            className="rounded-2xl p-3 flex items-center gap-3"
            style={{
              background: t.pill,
              border: `2px solid ${t.primary}`,
            }}
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm"
              style={{ background: t.gradient, color: '#fff' }}
            >
              #{myEntry.rank}
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold" style={{ color: t.text }}>Your position</p>
              <p className="text-xs" style={{ color: t.textMuted }}>{myEntry.xp} XP · {myEntry.userRank} rank</p>
            </div>
            <div className="flex items-center gap-1">
              <Flame size={14} style={{ color: t.gold }} />
              <span className="text-sm font-bold" style={{ color: t.gold }}>{myEntry.streak}</span>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 scroll-y px-5 py-3 flex flex-col gap-2">
        {filtered.map((entry, idx) => {
          const isTop3 = entry.rank <= 3;
          return (
            <div
              key={entry.username}
              className={`anim-slideIn rounded-2xl p-4 flex items-center gap-3 ${entry.isMe ? 'anim-delay-3' : ''}`}
              style={{
                animationDelay: `${idx * 0.05}s`,
                background: entry.isMe ? t.pill : t.surface,
                border: `1px solid ${entry.isMe ? t.primary : t.border}`,
              }}
            >
              {/* Position */}
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0"
                style={{
                  background: isTop3 ? POSITION_COLORS[entry.rank - 1] + '22' : t.border,
                  color: isTop3 ? POSITION_COLORS[entry.rank - 1] : t.textMuted,
                }}
              >
                {isTop3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : `#${entry.rank}`}
              </div>

              {/* Avatar */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: t.cardGradient }}
              >
                {entry.avatar}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="font-bold text-sm truncate"
                    style={{ color: entry.isMe ? t.primary : t.text }}
                  >
                    {entry.name}
                    {entry.isMe && ' (You)'}
                  </span>
                  <span
                    className="text-xs font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={{ color: RANK_COLORS[entry.userRank], background: RANK_COLORS[entry.userRank] + '22' }}
                  >
                    {entry.userRank}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs" style={{ color: t.textMuted }}>{entry.university}</span>
                  <span className="text-xs" style={{ color: t.textMuted }}>·</span>
                  <Flame size={10} style={{ color: t.gold }} />
                  <span className="text-xs font-semibold" style={{ color: t.gold }}>{entry.streak}</span>
                </div>
              </div>

              {/* XP */}
              <div className="text-right flex-shrink-0">
                <p className="text-base font-black" style={{ color: entry.isMe ? t.primary : t.text }}>
                  {entry.xp.toLocaleString()}
                </p>
                <p className="text-xs" style={{ color: t.textMuted }}>XP</p>
              </div>
            </div>
          );
        })}
        <div className="h-4" />
      </div>
    </div>
  );
}
