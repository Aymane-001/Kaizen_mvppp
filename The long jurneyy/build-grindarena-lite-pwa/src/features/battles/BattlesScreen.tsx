import { useEffect } from 'react';
import { useStore, SessionDuration } from '../../lib/store';
import { getTheme } from '../../lib/theme';
import { Swords, Users, Clock, Trophy, Zap } from 'lucide-react';

function formatDuration(min: number) {
  if (min >= 60) return `${min / 60}h`;
  return `${min}m`;
}

function BattleCard({
  battle,
  userId,
  t,
}: {
  battle: ReturnType<typeof useStore.getState>['battles'][0];
  userId: string;
  t: ReturnType<typeof getTheme>;
}) {
  const sorted = [...battle.participants].sort((a, b) => b.xp - a.xp);
  const maxXp = Math.max(...battle.participants.map((p) => p.xp), 1);
  const myEntry = battle.participants.find((p) => p.userId === userId);
  const myRank = sorted.findIndex((p) => p.userId === userId) + 1;

  const statusLabel =
    battle.status === 'waiting' ? '⏳ Waiting...' :
    battle.status === 'active' ? '🔴 Live' : '✅ Finished';

  return (
    <div className={`${t.bgCard} ${t.border} border rounded-2xl p-4 space-y-3`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Swords size={16} className={t.accentText} />
          <span className={`text-sm font-bold ${t.text}`}>
            {battle.type === '1v1' ? '1v1 Battle' : 'Group Battle'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${t.textMuted}`}>{statusLabel}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${t.accentLight} ${t.accentText} font-semibold`}>
            <Clock size={10} className="inline mr-1" />
            {formatDuration(battle.duration)}
          </span>
        </div>
      </div>

      {/* Participants */}
      <div className="space-y-2">
        {sorted.map((p, idx) => {
          const pct = maxXp > 0 ? (p.xp / maxXp) * 100 : 0;
          const isMe = p.userId === userId;
          return (
            <div key={p.userId} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold w-4 ${idx === 0 ? 'text-amber-400' : t.textMuted}`}>
                    #{idx + 1}
                  </span>
                  <span className={`text-sm font-medium ${isMe ? t.accentText : t.text}`}>
                    {p.name}{isMe ? ' (you)' : ''}
                  </span>
                </div>
                <span className={`text-xs font-mono font-bold ${t.text}`}>
                  {Math.floor(p.xp)} XP
                </span>
              </div>
              <div className={`h-1.5 ${t.bgInput} rounded-full overflow-hidden`}>
                <div
                  className={`h-full rounded-full transition-all duration-500 ${isMe ? t.xpBar : 'bg-slate-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* My status */}
      {myEntry && battle.status === 'finished' && (
        <div className={`text-center py-2 rounded-xl text-sm font-bold ${myRank === 1 ? 'text-amber-400 bg-amber-900/20' : t.textMuted}`}>
          {myRank === 1 ? '🏆 You won!' : `#${myRank} — better luck next time`}
        </div>
      )}
    </div>
  );
}

// ─── Study Room Card ────────────────────────────────────────────────────────
function RoomCard({
  room,
  onJoin,
  onLeave,
  isActive,
  t,
}: {
  room: ReturnType<typeof useStore.getState>['studyRooms'][0];
  onJoin: () => void;
  onLeave: () => void;
  isActive: boolean;
  t: ReturnType<typeof getTheme>;
}) {
  return (
    <div className={`${t.bgCard} ${t.border} border rounded-2xl p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={16} className={t.accentText} />
          <span className={`font-bold text-sm ${t.text}`}>{room.name}</span>
        </div>
        <span className={`text-xs ${t.textMuted}`}>{room.participants.length} in room</span>
      </div>
      {room.participants.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {room.participants.map((p) => (
            <span key={p.userId} className={`text-xs px-2 py-0.5 rounded-full ${t.accentLight} ${t.accentText}`}>
              {p.name}
            </span>
          ))}
        </div>
      )}
      <button
        onClick={isActive ? onLeave : onJoin}
        className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95
          ${isActive ? `${t.border} border ${t.textMuted}` : `${t.accent} ${t.accentHover} ${t.textInverse}`}`}
      >
        {isActive ? 'Leave Room' : 'Join Room'}
      </button>
    </div>
  );
}

// ─── Create Battle Form ─────────────────────────────────────────────────────
function CreateBattle({ t }: { t: ReturnType<typeof getTheme> }) {
  const { createBattle, joinBattle, activeBattleId } = useStore();

  const handleCreate = (duration: SessionDuration, type: '1v1' | 'group') => {
    const id = createBattle(duration, type);
    // Short delay then join
    setTimeout(() => {
      joinBattle(id);
    }, 2500);
  };

  if (activeBattleId) return null;

  return (
    <div className={`${t.bgCard} ${t.border} border rounded-2xl p-4 space-y-3`}>
      <div className="flex items-center gap-2">
        <Zap size={16} className={t.accentText} />
        <span className={`font-bold text-sm ${t.text}`}>Start a Battle</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {([25, 50, 120] as SessionDuration[]).map((d) => (
          <button
            key={d}
            onClick={() => handleCreate(d, '1v1')}
            className={`py-3 rounded-xl text-sm font-bold ${t.accent} ${t.accentHover} ${t.textInverse} transition-all active:scale-95`}
          >
            {formatDuration(d)}<br />
            <span className="text-xs font-normal opacity-80">1v1</span>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {([25, 50, 120] as SessionDuration[]).map((d) => (
          <button
            key={d}
            onClick={() => handleCreate(d, 'group')}
            className={`py-3 rounded-xl text-sm font-bold ${t.bgInput} ${t.border} border ${t.text} transition-all active:scale-95`}
          >
            {formatDuration(d)}<br />
            <span className="text-xs font-normal opacity-80">Group</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Battle Invite Banner ───────────────────────────────────────────────────
function InviteBanner({ t }: { t: ReturnType<typeof getTheme> }) {
  const { battleInvites, acceptBattleInvite, dismissInvite } = useStore();
  const invite = battleInvites[0];
  if (!invite) return null;

  return (
    <div className={`fixed top-0 left-0 right-0 z-40 ${t.bgCard} ${t.border} border-b shadow-xl px-4 py-3`}>
      <div className="flex items-center gap-3">
        <Swords size={18} className={t.accentText} />
        <div className="flex-1">
          <p className={`text-sm font-bold ${t.text}`}>{invite.from} challenged you!</p>
          <p className={`text-xs ${t.textMuted}`}>{invite.duration} min battle</p>
        </div>
        <button
          onClick={() => acceptBattleInvite(invite.id)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold ${t.accent} ${t.textInverse}`}
        >
          Accept
        </button>
        <button
          onClick={() => dismissInvite(invite.id)}
          className={`px-2 py-1.5 rounded-lg text-xs font-semibold ${t.bgInput} ${t.textMuted}`}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ─── Main Battles Screen ────────────────────────────────────────────────────
export function BattlesScreen() {
  const {
    battles, userId, studyRooms, activeRoomId,
    joinRoom, leaveRoom, themeColor, themeMode,
    battleInvites, simulateBattleTick,
  } = useStore();
  const t = getTheme(themeColor, themeMode);

  // Simulate opponent progress
  useEffect(() => {
    const interval = setInterval(simulateBattleTick, 1000);
    return () => clearInterval(interval);
  }, [simulateBattleTick]);

  const recent = battles.slice(0, 5);

  return (
    <div className={`min-h-screen ${t.bg} pb-20`}>
      <InviteBanner t={t} />

      <div className={`px-4 pt-6 ${battleInvites.length > 0 ? 'mt-16' : ''} space-y-4`}>
        <h1 className={`text-2xl font-black ${t.text}`}>Battles & Rooms</h1>

        {/* Create Battle */}
        <CreateBattle t={t} />

        {/* Study Rooms */}
        <div>
          <h2 className={`text-sm font-bold ${t.textMuted} uppercase tracking-wide mb-3`}>Study Rooms</h2>
          <div className="space-y-3">
            {studyRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                onJoin={() => joinRoom(room.id)}
                onLeave={leaveRoom}
                isActive={activeRoomId === room.id}
                t={t}
              />
            ))}
          </div>
        </div>

        {/* Recent Battles */}
        {recent.length > 0 && (
          <div>
            <h2 className={`text-sm font-bold ${t.textMuted} uppercase tracking-wide mb-3 flex items-center gap-2`}>
              <Trophy size={13} /> Recent Battles
            </h2>
            <div className="space-y-3">
              {recent.map((b) => (
                <BattleCard key={b.id} battle={b} userId={userId} t={t} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
