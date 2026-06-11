import { useState, useEffect } from 'react';
import { useStore, Tier } from '../../lib/store';
import { getTheme } from '../../lib/theme';
import { Crown, Flame, TrendingUp } from 'lucide-react';

function TierBadge({ tier }: { tier: Tier }) {
  const config = {
    Gold:   { emoji: '🥇', color: 'text-amber-400',   bg: 'bg-amber-900/30' },
    Silver: { emoji: '🥈', color: 'text-slate-300',   bg: 'bg-slate-700/40' },
    Bronze: { emoji: '🥉', color: 'text-orange-400',  bg: 'bg-orange-900/20' },
  }[tier];
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${config.color} ${config.bg}`}>
      {config.emoji} {tier}
    </span>
  );
}

export function LeaderboardScreen() {
  const { leaderboard, userId, totalXp, streak, themeColor, themeMode, refreshLeaderboard } = useStore();
  const t = getTheme(themeColor, themeMode);
  const [tab, setTab] = useState<'daily' | 'weekly'>('daily');

  useEffect(() => {
    refreshLeaderboard();
  }, [refreshLeaderboard]);

  // For weekly tab, slightly shuffle XP
  const entries = tab === 'weekly'
    ? [...leaderboard].map((e) => ({ ...e, xp: Math.floor(e.xp * 7 * (0.9 + Math.random() * 0.2)) }))
      .sort((a, b) => b.xp - a.xp)
    : leaderboard;

  const myRank = entries.findIndex((e) => e.id === userId) + 1;

  return (
    <div className={`min-h-screen ${t.bg} pb-20`}>
      <div className="px-4 pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className={`text-2xl font-black ${t.text}`}>Leaderboard</h1>
          <div className={`flex items-center gap-1 text-xs ${t.textMuted}`}>
            <Crown size={13} className="text-amber-400" /> AUI Only
          </div>
        </div>

        {/* Tab */}
        <div className={`flex ${t.bgCard} ${t.border} border rounded-xl p-1 gap-1`}>
          {(['daily', 'weekly'] as const).map((t_) => (
            <button
              key={t_}
              onClick={() => setTab(t_)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all
                ${tab === t_ ? `${t.accent} ${t.textInverse}` : `${t.textMuted}`}`}
            >
              {t_}
            </button>
          ))}
        </div>

        {/* My rank card */}
        <div className={`${t.accentLight} ${t.border} border rounded-2xl p-4 flex items-center gap-4`}>
          <div className={`text-3xl font-black ${t.accentText}`}>#{myRank || '–'}</div>
          <div>
            <p className={`font-bold ${t.text}`}>Your Rank</p>
            <p className={`text-xs ${t.textMuted}`}>{Math.floor(totalXp)} XP • {streak} day streak</p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Flame size={16} className="text-orange-400" />
            <span className={`text-sm font-bold text-orange-400`}>{streak}d</span>
          </div>
        </div>

        {/* Top 3 */}
        {entries.length >= 3 && (
          <div className="grid grid-cols-3 gap-2">
            {[entries[1], entries[0], entries[2]].map((e, podiumIdx) => {
              const positions = [2, 1, 3];
              const pos = positions[podiumIdx];
              const heights = ['h-16', 'h-20', 'h-14'];
              const isMe = e?.id === userId;
              return (
                <div key={e?.id} className="flex flex-col items-center gap-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm
                    ${isMe ? `${t.accent} ${t.textInverse}` : `${t.bgCard} ${t.text} ${t.border} border`}`}>
                    {(e?.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <p className={`text-xs font-semibold ${isMe ? t.accentText : t.text} text-center truncate w-full`}>
                    {e?.name || '?'}
                  </p>
                  <div className={`w-full ${heights[podiumIdx]} ${t.bgCard} ${t.border} border rounded-t-xl flex flex-col items-center justify-center gap-1`}>
                    <span className="text-lg">{pos === 1 ? '🥇' : pos === 2 ? '🥈' : '🥉'}</span>
                    <span className={`text-xs font-bold ${t.accentText}`}>{Math.floor(e?.xp || 0)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Full list */}
        <div className="space-y-2">
          <h2 className={`text-xs font-semibold ${t.textMuted} uppercase tracking-wide flex items-center gap-1`}>
            <TrendingUp size={12} /> Rankings
          </h2>
          {entries.map((e, idx) => {
            const isMe = e.id === userId;
            return (
              <div
                key={e.id}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                  ${isMe
                    ? `${t.accentLight} ${t.border} border ring-1 ${t.accentRing}`
                    : `${t.bgCard} ${t.border} border`
                  }`}
              >
                <span className={`text-sm font-bold w-6 text-center ${
                  idx === 0 ? 'text-amber-400' :
                  idx === 1 ? 'text-slate-300' :
                  idx === 2 ? 'text-orange-400' :
                  t.textMuted
                }`}>
                  {idx + 1}
                </span>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0
                  ${isMe ? `${t.accent} ${t.textInverse}` : `${t.bgInput} ${t.text}`}`}>
                  {e.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${isMe ? t.accentText : t.text} truncate`}>
                    {e.name}{isMe ? ' (you)' : ''}
                  </p>
                  <TierBadge tier={e.tier} />
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold font-mono ${t.text}`}>{Math.floor(e.xp).toLocaleString()}</p>
                  <p className={`text-xs ${t.textMuted}`}>XP</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
