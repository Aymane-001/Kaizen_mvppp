import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Types ─────────────────────────────────────────────────────────────────

export type ThemeColor = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'neutral';
export type ThemeMode = 'light' | 'dark';
export type Tier = 'Bronze' | 'Silver' | 'Gold';
export type SessionMode = 'camera' | 'manual';
export type SessionDuration = 25 | 50 | 120;

export interface Session {
  id: string;
  xp: number;
  duration: number; // minutes
  mode: SessionMode;
  createdAt: number;
}

export interface Battle {
  id: string;
  duration: SessionDuration;
  type: '1v1' | 'group';
  status: 'waiting' | 'active' | 'finished';
  participants: BattleParticipant[];
  startedAt?: number;
  createdAt: number;
}

export interface BattleParticipant {
  userId: string;
  name: string;
  xp: number;
}

export interface StudyRoom {
  id: string;
  name: string;
  participants: { userId: string; name: string; joinedAt: number }[];
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  xp: number;
  tier: Tier;
  streak: number;
}

export interface Challenge {
  id: string;
  title: string;
  goal: number;
  progress: number;
  rewardXp: number;
  expiresAt: number;
  completed: boolean;
  unit: 'sessions' | 'battles' | 'minutes';
}

export interface BattleInvite {
  id: string;
  from: string;
  battleId: string;
  duration: SessionDuration;
  expiresAt: number;
}

// ─── State Interface ───────────────────────────────────────────────────────

interface AppState {
  // User
  userId: string;
  userName: string;
  totalXp: number;
  streak: number;
  lastActiveAt: number;
  sessionHistory: Session[];

  // Focus Session
  activeSession: {
    running: boolean;
    mode: SessionMode;
    startedAt: number;
    xp: number;
    targetDuration: SessionDuration | null;
    multiplier: number;
    focusLostAt: number | null;
    comebackBonusActive: boolean;
    battleId: string | null;
  } | null;

  // Battles
  battles: Battle[];
  activeBattleId: string | null;
  battleInvites: BattleInvite[];

  // Study Rooms
  studyRooms: StudyRoom[];
  activeRoomId: string | null;

  // Leaderboard (simulated)
  leaderboard: LeaderboardEntry[];

  // Challenges
  challenges: Challenge[];

  // Theme
  themeColor: ThemeColor;
  themeMode: ThemeMode;

  // Nav
  activeScreen: 'focus' | 'battles' | 'leaderboard' | 'profile';

  // UI flags
  showComebackBanner: boolean;
  showChallengeCompleted: string | null;

  // Actions
  setUserName: (name: string) => void;
  setTheme: (color: ThemeColor, mode: ThemeMode) => void;
  setScreen: (screen: AppState['activeScreen']) => void;

  startSession: (mode: SessionMode, duration: SessionDuration | null, battleId?: string) => void;
  tickSession: () => void;
  pauseSession: () => void;
  resumeSession: () => void;
  endSession: () => void;
  setFocusLost: (lost: boolean) => void;

  createBattle: (duration: SessionDuration, type: '1v1' | 'group') => string;
  joinBattle: (battleId: string) => void;
  acceptBattleInvite: (inviteId: string) => void;
  dismissInvite: (inviteId: string) => void;
  simulateBattleTick: () => void;

  joinRoom: (roomId: string) => void;
  leaveRoom: () => void;

  dismissComebackBanner: () => void;
  dismissChallengeCompleted: () => void;

  initChallenges: () => void;
  updateChallengeProgress: (unit: Challenge['unit'], amount: number) => void;

  checkDecay: () => void;
  generateInvite: () => void;
  refreshLeaderboard: () => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const uuid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function getTier(xp: number): Tier {
  if (xp >= 5000) return 'Gold';
  if (xp >= 1500) return 'Silver';
  return 'Bronze';
}

const FAKE_NAMES = [
  'Yassine', 'Fatima', 'Omar', 'Salma', 'Karim', 'Nadia', 'Hamza', 'Rim',
  'Mehdi', 'Layla', 'Amine', 'Sara', 'Younes', 'Hana', 'Tarik', 'Lina',
];

function generateLeaderboard(myId: string, myName: string, myXp: number): LeaderboardEntry[] {
  const stored = JSON.parse(localStorage.getItem('ga_leaderboard_seed') || 'null');
  let entries: LeaderboardEntry[];

  if (stored) {
    entries = stored;
    // Update current user
    const idx = entries.findIndex((e: LeaderboardEntry) => e.id === myId);
    if (idx !== -1) {
      entries[idx].xp = myXp;
      entries[idx].name = myName || 'You';
      entries[idx].tier = getTier(myXp);
    }
  } else {
    // Generate fake entries
    const fakeEntries: LeaderboardEntry[] = FAKE_NAMES.slice(0, 12).map((name) => ({
      id: uuid(),
      name,
      xp: Math.floor(Math.random() * 6000) + 200,
      tier: 'Bronze' as Tier,
      streak: Math.floor(Math.random() * 14),
    })).map(e => ({ ...e, tier: getTier(e.xp) }));

    entries = [
      ...fakeEntries,
      { id: myId, name: myName || 'You', xp: myXp, tier: getTier(myXp), streak: 0 },
    ];
    localStorage.setItem('ga_leaderboard_seed', JSON.stringify(entries));
  }

  return [...entries].sort((a, b) => b.xp - a.xp);
}

const DEFAULT_STUDY_ROOMS: StudyRoom[] = [
  { id: 'quiet', name: 'Quiet Room', participants: [] },
  { id: 'latenight', name: 'Late Night Room', participants: [] },
];

const monthEnd = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const DEFAULT_CHALLENGES: Challenge[] = [
  { id: 'c1', title: 'Complete 20 sessions this month', goal: 20, progress: 0, rewardXp: 500, expiresAt: monthEnd(), completed: false, unit: 'sessions' },
  { id: 'c2', title: 'Win 5 battles', goal: 5, progress: 0, rewardXp: 300, expiresAt: monthEnd(), completed: false, unit: 'battles' },
  { id: 'c3', title: 'Focus for 600 minutes total', goal: 600, progress: 0, rewardXp: 800, expiresAt: monthEnd(), completed: false, unit: 'minutes' },
  { id: 'c4', title: 'Maintain a 7-day streak', goal: 7, progress: 0, rewardXp: 400, expiresAt: monthEnd(), completed: false, unit: 'sessions' },
];

// ─── Store ─────────────────────────────────────────────────────────────────

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      userId: uuid(),
      userName: '',
      totalXp: 0,
      streak: 0,
      lastActiveAt: 0,
      sessionHistory: [],

      activeSession: null,
      battles: [],
      activeBattleId: null,
      battleInvites: [],
      studyRooms: DEFAULT_STUDY_ROOMS,
      activeRoomId: null,
      leaderboard: [],
      challenges: DEFAULT_CHALLENGES,

      themeColor: 'blue',
      themeMode: 'dark',
      activeScreen: 'focus',
      showComebackBanner: false,
      showChallengeCompleted: null,

      // ── User ──
      setUserName: (name) => set({ userName: name }),

      setTheme: (color, mode) => set({ themeColor: color, themeMode: mode }),

      setScreen: (screen) => {
        set({ activeScreen: screen });
        if (screen === 'leaderboard') {
          get().refreshLeaderboard();
        }
      },

      // ── Session ──
      startSession: (mode, duration, battleId) => {
        const { lastActiveAt } = get();
        const now = Date.now();
        const hoursSinceActive = lastActiveAt ? (now - lastActiveAt) / 3600000 : 0;
        const comebackBonus = hoursSinceActive >= 48 && lastActiveAt > 0;

        set({
          activeSession: {
            running: true,
            mode,
            startedAt: now,
            xp: 0,
            targetDuration: duration,
            multiplier: 1,
            focusLostAt: null,
            comebackBonusActive: comebackBonus,
            battleId: battleId || null,
          },
          showComebackBanner: comebackBonus,
        });
        get().checkDecay();
        get().refreshLeaderboard();
      },

      tickSession: () => {
        const s = get().activeSession;
        if (!s || !s.running) return;

        const elapsed = (Date.now() - s.startedAt) / 60000; // minutes
        let multiplier = 1;
        if (elapsed >= 50) multiplier = 2;
        else if (elapsed >= 25) multiplier = 1.5;
        else if (elapsed >= 10) multiplier = 1.2;

        // If focus lost > 10s, reset multiplier
        if (s.focusLostAt && Date.now() - s.focusLostAt > 10000) {
          multiplier = 1;
        }

        const baseXp = s.running ? 1 : 0;
        const comebackMult = s.comebackBonusActive ? 1.5 : 1;
        const gainedXp = s.focusLostAt ? 0 : baseXp * multiplier * comebackMult;

        set((state) => ({
          activeSession: state.activeSession
            ? { ...state.activeSession, xp: state.activeSession.xp + gainedXp, multiplier }
            : null,
        }));

        // Update battle XP
        const { battles, activeBattleId } = get();
        if (activeBattleId) {
          const updatedBattles = battles.map((b) => {
            if (b.id !== activeBattleId) return b;
            return {
              ...b,
              participants: b.participants.map((p) =>
                p.userId === get().userId ? { ...p, xp: p.xp + gainedXp } : p
              ),
            };
          });
          set({ battles: updatedBattles });
        }
      },

      pauseSession: () => {
        set((state) => ({
          activeSession: state.activeSession ? { ...state.activeSession, running: false } : null,
        }));
      },

      resumeSession: () => {
        set((state) => ({
          activeSession: state.activeSession ? { ...state.activeSession, running: true, focusLostAt: null } : null,
        }));
      },

      setFocusLost: (lost) => {
        set((state) => ({
          activeSession: state.activeSession
            ? { ...state.activeSession, focusLostAt: lost ? (state.activeSession.focusLostAt ?? Date.now()) : null }
            : null,
        }));
      },

      endSession: () => {
        const { activeSession, totalXp, sessionHistory, streak, lastActiveAt, activeBattleId, battles } = get();
        if (!activeSession) return;

        const now = Date.now();
        const sessionXp = Math.floor(activeSession.xp);
        const duration = Math.floor((now - activeSession.startedAt) / 60000);

        // Streak logic
        const lastDate = new Date(lastActiveAt).toDateString();
        const today = new Date().toDateString();
        const yesterday = new Date(now - 86400000).toDateString();
        let newStreak = streak;
        if (lastDate === today) newStreak = streak;
        else if (lastDate === yesterday) newStreak = streak + 1;
        else newStreak = 1;

        const newSession: Session = {
          id: uuid(),
          xp: sessionXp,
          duration,
          mode: activeSession.mode,
          createdAt: now,
        };

        // Check battle finish
        let updatedBattles = battles;
        if (activeBattleId) {
          updatedBattles = battles.map((b) =>
            b.id === activeBattleId ? { ...b, status: 'finished' as const } : b
          );
        }

        set({
          totalXp: totalXp + sessionXp,
          streak: newStreak,
          lastActiveAt: now,
          sessionHistory: [newSession, ...sessionHistory].slice(0, 5),
          activeSession: null,
          activeBattleId: null,
          battles: updatedBattles,
          showComebackBanner: false,
        });

        get().updateChallengeProgress('sessions', 1);
        get().updateChallengeProgress('minutes', duration);
        get().refreshLeaderboard();
      },

      // ── Battles ──
      createBattle: (duration, type) => {
        const { userId, userName } = get();
        const id = uuid();
        const battle: Battle = {
          id,
          duration,
          type,
          status: 'waiting',
          participants: [{ userId, name: userName || 'You', xp: 0 }],
          createdAt: Date.now(),
        };

        // Add fake opponents
        const fakeCount = type === '1v1' ? 1 : Math.floor(Math.random() * 3) + 1;
        for (let i = 0; i < fakeCount; i++) {
          battle.participants.push({
            userId: uuid(),
            name: FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)],
            xp: 0,
          });
        }

        set((state) => ({ battles: [battle, ...state.battles] }));

        // Auto-start after 2s simulation
        setTimeout(() => {
          set((state) => ({
            battles: state.battles.map((b) =>
              b.id === id ? { ...b, status: 'active', startedAt: Date.now() } : b
            ),
          }));
        }, 2000);

        return id;
      },

      joinBattle: (battleId) => {
        const { userId, userName, battles } = get();
        const battle = battles.find((b) => b.id === battleId);
        if (!battle) return;

        const already = battle.participants.find((p) => p.userId === userId);
        if (!already) {
          const updated = battles.map((b) =>
            b.id === battleId
              ? { ...b, participants: [...b.participants, { userId, name: userName || 'You', xp: 0 }] }
              : b
          );
          set({ battles: updated });
        }
        set({ activeBattleId: battleId });
        get().startSession('manual', battle.duration as SessionDuration, battleId);
      },

      acceptBattleInvite: (inviteId) => {
        const invite = get().battleInvites.find((i) => i.id === inviteId);
        if (!invite) return;
        get().joinBattle(invite.battleId);
        set((state) => ({
          battleInvites: state.battleInvites.filter((i) => i.id !== inviteId),
        }));
      },

      dismissInvite: (inviteId) => {
        set((state) => ({
          battleInvites: state.battleInvites.filter((i) => i.id !== inviteId),
        }));
      },

      simulateBattleTick: () => {
        const { battles, userId } = get();
        const updated = battles.map((b) => {
          if (b.status !== 'active') return b;
          return {
            ...b,
            participants: b.participants.map((p) => {
              if (p.userId === userId) return p;
              // Simulate opponents
              const gain = Math.random() * 1.5;
              return { ...p, xp: p.xp + gain };
            }),
          };
        });
        set({ battles: updated });
      },

      // ── Rooms ──
      joinRoom: (roomId) => {
        const { userId, userName, studyRooms } = get();
        const updated = studyRooms.map((r) => {
          if (r.id !== roomId) return r;
          const already = r.participants.find((p) => p.userId === userId);
          if (already) return r;
          return {
            ...r,
            participants: [...r.participants, { userId, name: userName || 'You', joinedAt: Date.now() }],
          };
        });
        set({ studyRooms: updated, activeRoomId: roomId });
      },

      leaveRoom: () => {
        const { userId, studyRooms, activeRoomId } = get();
        const updated = studyRooms.map((r) =>
          r.id === activeRoomId
            ? { ...r, participants: r.participants.filter((p) => p.userId !== userId) }
            : r
        );
        set({ studyRooms: updated, activeRoomId: null });
      },

      // ── UI ──
      dismissComebackBanner: () => set({ showComebackBanner: false }),
      dismissChallengeCompleted: () => set({ showChallengeCompleted: null }),

      // ── Challenges ──
      initChallenges: () => {
        const { challenges } = get();
        const now = Date.now();
        const expired = challenges.filter((c) => c.expiresAt < now);
        if (expired.length > 0) {
          set({ challenges: DEFAULT_CHALLENGES });
        }
      },

      updateChallengeProgress: (unit, amount) => {
        const { challenges, totalXp } = get();
        let bonusXp = 0;
        let completedTitle: string | null = null;

        const updated = challenges.map((c) => {
          if (c.completed || c.unit !== unit) return c;
          const newProgress = c.progress + amount;
          if (newProgress >= c.goal) {
            bonusXp += c.rewardXp;
            completedTitle = c.title;
            return { ...c, progress: c.goal, completed: true };
          }
          return { ...c, progress: newProgress };
        });

        set({
          challenges: updated,
          totalXp: totalXp + bonusXp,
          showChallengeCompleted: completedTitle,
        });
      },

      // ── Decay ──
      checkDecay: () => {
        const { lastActiveAt, totalXp } = get();
        if (!lastActiveAt) return;
        const hours = (Date.now() - lastActiveAt) / 3600000;
        if (hours >= 48) {
          set({ totalXp: Math.max(0, totalXp - 30) });
        }
      },

      // ── Generate Invite ──
      generateInvite: () => {
        const fromName = FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)];
        const durations: SessionDuration[] = [25, 50, 120];
        const duration = durations[Math.floor(Math.random() * durations.length)];
        const battleId = get().createBattle(duration, '1v1');
        const invite: BattleInvite = {
          id: uuid(),
          from: fromName,
          battleId,
          duration,
          expiresAt: Date.now() + 30000,
        };
        set((state) => ({ battleInvites: [invite, ...state.battleInvites].slice(0, 3) }));
      },

      // ── Leaderboard ──
      refreshLeaderboard: () => {
        const { userId, userName, totalXp, streak } = get();
        const entries = generateLeaderboard(userId, userName, totalXp);
        // Inject streak for self
        const withStreak = entries.map((e) =>
          e.id === userId ? { ...e, streak } : e
        );
        set({ leaderboard: withStreak });
      },
    }),
    {
      name: 'grind-arena-lite',
      partialize: (state) => ({
        userId: state.userId,
        userName: state.userName,
        totalXp: state.totalXp,
        streak: state.streak,
        lastActiveAt: state.lastActiveAt,
        sessionHistory: state.sessionHistory,
        challenges: state.challenges,
        themeColor: state.themeColor,
        themeMode: state.themeMode,
        studyRooms: state.studyRooms,
      }),
    }
  )
);
