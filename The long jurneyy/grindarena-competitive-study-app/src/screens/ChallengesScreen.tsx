import { useState } from 'react';
import { useStore } from '../store/useStore';
import { themes } from '../theme/themes';
import { Swords, Clock, Plus, ChevronRight } from 'lucide-react';
import type { Battle, Rank } from '../store/useStore';

const RANK_COLORS: Record<string, string> = {
  Bronze: '#cd7f32', Silver: '#c0c0c0', Gold: '#ffd700',
  Platinum: '#e5e4e2', Diamond: '#b9f2ff', Legend: '#ff6b35',
};

const opponents = [
  { name: 'Youssef Karimi', username: 'ykarimi', avatar: '🦁', rank: 'Diamond' as Rank, university: 'AUI', xp: 9840 },
  { name: 'Salma Benali', username: 'sbenali', avatar: '🐯', rank: 'Diamond' as Rank, university: 'AUI', xp: 8200 },
  { name: 'Omar Tazi', username: 'otazi', avatar: '🦊', rank: 'Platinum' as Rank, university: 'ENSIAS', xp: 7650 },
  { name: 'Nadia Alaoui', username: 'nalaoui', avatar: '🐺', rank: 'Platinum' as Rank, university: 'ENSA', xp: 6900 },
  { name: 'Khalid Fassi', username: 'kfassi', avatar: '🦅', rank: 'Gold' as Rank, university: 'AUI', xp: 5800 },
  { name: 'Aya Chraibi', username: 'achraibi', avatar: '🌟', rank: 'Silver' as Rank, university: 'AUI', xp: 2100 },
];

const DURATIONS = [15, 25, 50, 90];

export default function ChallengesScreen() {
  const { theme, challenges, acceptChallenge, declineChallenge, startBattle } = useStore();
  const t = themes[theme];
  const [tab, setTab] = useState<'incoming' | 'find'>('incoming');
  const [selectedDuration, setSelectedDuration] = useState(25);

  const handleChallenge = (opp: typeof opponents[0]) => {
    const battle: Battle = {
      id: `battle_${Date.now()}`,
      opponentName: opp.name,
      opponentUsername: opp.username,
      opponentAvatar: opp.avatar,
      opponentRank: opp.rank,
      duration: selectedDuration,
      myScore: 0,
      opponentScore: 0,
      status: 'active',
      startTime: Date.now(),
    };
    startBattle(battle);
  };

  return (
    <div className="h-full w-full flex flex-col" style={{ background: t.bg }}>
      {/* Header */}
      <div
        className="px-5 pt-12 pb-4"
        style={{ background: t.surface, borderBottom: `1px solid ${t.border}` }}
      >
        <h1 className="text-2xl font-black mb-4" style={{ color: t.text }}>⚔️ Battle</h1>

        {/* Tabs */}
        <div
          className="flex rounded-xl p-1"
          style={{ background: t.bg }}
        >
          {(['incoming', 'find'] as const).map((tab_opt) => (
            <button
              key={tab_opt}
              className="press-effect flex-1 py-2 rounded-lg text-sm font-bold transition-all"
              style={{
                background: tab === tab_opt ? t.gradient : 'transparent',
                color: tab === tab_opt ? '#fff' : t.textMuted,
              }}
              onClick={() => setTab(tab_opt)}
            >
              {tab_opt === 'incoming' ? `Incoming (${challenges.length})` : 'Find Opponent'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 scroll-y px-5 py-4 flex flex-col gap-4">
        {tab === 'incoming' ? (
          <>
            {challenges.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 pt-16">
                <span className="text-6xl">🕊️</span>
                <p className="text-base font-semibold" style={{ color: t.textMuted }}>
                  No incoming challenges
                </p>
                <p className="text-sm text-center" style={{ color: t.textMuted }}>
                  Challenge someone first or wait for them to come to you
                </p>
                <button
                  className="press-effect px-6 py-3 rounded-2xl font-bold"
                  style={{ background: t.gradient, color: '#fff' }}
                  onClick={() => setTab('find')}
                >
                  Find Opponent
                </button>
              </div>
            ) : (
              challenges.map((c) => (
                <div
                  key={c.id}
                  className="anim-slideIn rounded-2xl p-4 flex flex-col gap-3"
                  style={{ background: t.surface, border: `1px solid ${t.border}` }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
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
                      <div className="flex items-center gap-2 mt-0.5">
                        <Clock size={12} style={{ color: t.textMuted }} />
                        <span className="text-xs" style={{ color: t.textMuted }}>
                          {c.duration}min · expires {c.expiresIn}
                        </span>
                      </div>
                    </div>
                    {c.type === 'squad' && (
                      <span
                        className="text-xs font-bold px-2 py-1 rounded-lg"
                        style={{ background: t.pill, color: t.primary }}
                      >
                        Squad
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      className="press-effect flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                      style={{ background: t.gradient, color: '#fff' }}
                      onClick={() => acceptChallenge(c.id)}
                    >
                      <Swords size={16} />
                      Accept Battle
                    </button>
                    <button
                      className="press-effect py-3 px-4 rounded-xl font-bold"
                      style={{ background: t.border, color: t.textMuted }}
                      onClick={() => declineChallenge(c.id)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        ) : (
          <>
            {/* Duration selector */}
            <div className="flex flex-col gap-2">
              <p className="text-sm font-bold" style={{ color: t.textMuted }}>SESSION LENGTH</p>
              <div className="grid grid-cols-4 gap-2">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    className="press-effect py-2.5 rounded-xl text-sm font-bold"
                    style={{
                      background: selectedDuration === d ? t.gradient : t.surface,
                      color: selectedDuration === d ? '#fff' : t.textMuted,
                      border: `1px solid ${selectedDuration === d ? 'transparent' : t.border}`,
                    }}
                    onClick={() => setSelectedDuration(d)}
                  >
                    {d}m
                  </button>
                ))}
              </div>
            </div>

            {/* Opponent list */}
            <p className="text-sm font-bold" style={{ color: t.textMuted }}>CHOOSE OPPONENT</p>
            {opponents.map((opp) => (
              <button
                key={opp.username}
                className="press-effect w-full rounded-2xl p-4 flex items-center gap-3"
                style={{ background: t.surface, border: `1px solid ${t.border}` }}
                onClick={() => handleChallenge(opp)}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                  style={{ background: t.cardGradient }}
                >
                  {opp.avatar}
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-bold" style={{ color: t.text }}>{opp.name}</span>
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ color: RANK_COLORS[opp.rank], background: RANK_COLORS[opp.rank] + '22' }}
                    >
                      {opp.rank}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: t.textMuted }}>
                    {opp.university} · {opp.xp.toLocaleString()} XP
                  </p>
                </div>
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: t.primary }}
                >
                  <ChevronRight size={18} color="#fff" />
                </div>
              </button>
            ))}

            {/* Quick battle vs random */}
            <button
              className="press-effect w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2"
              style={{ background: t.cardGradient, border: `2px dashed ${t.border}`, color: t.primary }}
              onClick={() => handleChallenge(opponents[Math.floor(Math.random() * opponents.length)])}
            >
              <Plus size={20} />
              Random Matchup ({selectedDuration}min)
            </button>
          </>
        )}

        <div className="h-4" />
      </div>
    </div>
  );
}
