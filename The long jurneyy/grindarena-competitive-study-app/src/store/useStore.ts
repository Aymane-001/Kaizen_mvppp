import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'violet' | 'ocean' | 'sunset' | 'mint' | 'rose' | 'amber';

export type Screen = 'splash' | 'onboarding' | 'home' | 'battle' | 'leaderboard' | 'squad' | 'profile' | 'challenges' | 'settings';

export type Rank = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Legend';

export interface User {
  id: string;
  name: string;
  username: string;
  university: string;
  avatar: string;
  xp: number;
  rank: Rank;
  streak: number;
  lastActiveDate: string;
  totalSessions: number;
  totalMinutes: number;
  wins: number;
  losses: number;
  badges: string[];
  squadId?: string;
}

export interface Battle {
  id: string;
  opponentName: string;
  opponentUsername: string;
  opponentAvatar: string;
  opponentRank: Rank;
  duration: number; // minutes
  myScore: number;
  opponentScore: number;
  status: 'pending' | 'active' | 'finished';
  result?: 'win' | 'loss' | 'draw';
  xpEarned?: number;
  startTime?: number;
}

export interface Challenge {
  id: string;
  fromName: string;
  fromUsername: string;
  fromAvatar: string;
  fromRank: Rank;
  duration: number;
  expiresIn: string;
  type: '1v1' | 'squad';
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  username: string;
  avatar: string;
  university: string;
  xp: number;
  userRank: Rank;
  streak: number;
  isMe?: boolean;
}

export interface SquadMember {
  id: string;
  name: string;
  username: string;
  avatar: string;
  rank: Rank;
  isOnline: boolean;
  xp: number;
}

interface AppState {
  theme: Theme;
  screen: Screen;
  user: User;
  currentBattle: Battle | null;
  challenges: Challenge[];
  leaderboard: LeaderboardEntry[];
  squad: SquadMember[];
  battleTimer: number;
  battleActive: boolean;
  onboardingStep: number;
  setTheme: (theme: Theme) => void;
  setScreen: (screen: Screen) => void;
  setUser: (updates: Partial<User>) => void;
  startBattle: (battle: Battle) => void;
  endBattle: (result: 'win' | 'loss' | 'draw') => void;
  tickBattle: () => void;
  acceptChallenge: (id: string) => void;
  declineChallenge: (id: string) => void;
  nextOnboardingStep: () => void;
  updateMyScore: (score: number) => void;
}

const RANKS: Rank[] = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Legend'];
const XP_THRESHOLDS = [0, 500, 1200, 2500, 5000, 10000];

function getRank(xp: number): Rank {
  let rank: Rank = 'Bronze';
  for (let i = 0; i < XP_THRESHOLDS.length; i++) {
    if (xp >= XP_THRESHOLDS[i]) rank = RANKS[i];
  }
  return rank;
}

const mockLeaderboard: LeaderboardEntry[] = [
  { rank: 1, name: 'Youssef Karimi', username: 'ykarimi', avatar: '🦁', university: 'AUI', xp: 9840, userRank: 'Diamond', streak: 21 },
  { rank: 2, name: 'Salma Benali', username: 'sbenali', avatar: '🐯', university: 'AUI', xp: 8200, userRank: 'Diamond', streak: 14 },
  { rank: 3, name: 'Omar Tazi', username: 'otazi', avatar: '🦊', university: 'ENSIAS', xp: 7650, userRank: 'Platinum', streak: 9 },
  { rank: 4, name: 'Nadia Alaoui', username: 'nalaoui', avatar: '🐺', university: 'ENSA', xp: 6900, userRank: 'Platinum', streak: 7 },
  { rank: 5, name: 'Khalid Fassi', username: 'kfassi', avatar: '🦅', university: 'AUI', xp: 5800, userRank: 'Gold', streak: 12 },
  { rank: 6, name: 'Me (You)', username: 'me', avatar: '⚡', university: 'AUI', xp: 2340, userRank: 'Silver', streak: 5, isMe: true },
  { rank: 7, name: 'Aya Chraibi', username: 'achraibi', avatar: '🌟', university: 'AUI', xp: 2100, userRank: 'Silver', streak: 3 },
  { rank: 8, name: 'Hamza Idrissi', username: 'hidrissi', avatar: '🎯', university: 'ENSIAS', xp: 1800, userRank: 'Silver', streak: 2 },
];

const mockSquad: SquadMember[] = [
  { id: '1', name: 'Khalid Fassi', username: 'kfassi', avatar: '🦅', rank: 'Gold', isOnline: true, xp: 5800 },
  { id: '2', name: 'Salma Benali', username: 'sbenali', avatar: '🐯', rank: 'Diamond', isOnline: true, xp: 8200 },
  { id: '3', name: 'Omar Tazi', username: 'otazi', avatar: '🦊', rank: 'Platinum', isOnline: false, xp: 7650 },
];

const mockChallenges: Challenge[] = [
  { id: 'c1', fromName: 'Youssef Karimi', fromUsername: 'ykarimi', fromAvatar: '🦁', fromRank: 'Diamond', duration: 25, expiresIn: '5h 20m', type: '1v1' },
  { id: 'c2', fromName: 'Khalid Fassi', fromUsername: 'kfassi', fromAvatar: '🦅', fromRank: 'Gold', duration: 50, expiresIn: '2h 10m', type: '1v1' },
];

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      theme: 'violet',
      screen: 'splash',
      onboardingStep: 0,
      currentBattle: null,
      battleTimer: 0,
      battleActive: false,
      challenges: mockChallenges,
      leaderboard: mockLeaderboard,
      squad: mockSquad,
      user: {
        id: 'me',
        name: 'You',
        username: 'me',
        university: 'AUI',
        avatar: '⚡',
        xp: 2340,
        rank: 'Silver',
        streak: 5,
        lastActiveDate: new Date().toDateString(),
        totalSessions: 42,
        totalMinutes: 1890,
        wins: 28,
        losses: 14,
        badges: ['🔥 First Win', '⚡ Speed Runner', '🏆 Week Warrior'],
        squadId: 'squad1',
      },

      setTheme: (theme) => set({ theme }),
      setScreen: (screen) => set({ screen }),
      setUser: (updates) => set((s) => ({ user: { ...s.user, ...updates } })),

      nextOnboardingStep: () => set((s) => ({ onboardingStep: s.onboardingStep + 1 })),

      startBattle: (battle) => set({
        currentBattle: battle,
        battleTimer: battle.duration * 60,
        battleActive: true,
        screen: 'battle',
      }),

      tickBattle: () => set((s) => {
        if (!s.battleActive || s.battleTimer <= 0) return {};
        const newTimer = s.battleTimer - 1;
        const newOppScore = Math.min(100, (s.currentBattle?.opponentScore ?? 0) + (Math.random() > 0.7 ? 1 : 0));
        return {
          battleTimer: newTimer,
          battleActive: newTimer > 0,
          currentBattle: s.currentBattle ? {
            ...s.currentBattle,
            opponentScore: newOppScore,
          } : null,
        };
      }),

      updateMyScore: (score) => set((s) => ({
        currentBattle: s.currentBattle ? { ...s.currentBattle, myScore: score } : null,
      })),

      endBattle: (result) => set((s) => {
        const xpMap = { win: 120, draw: 40, loss: 15 };
        const earned = xpMap[result];
        const newXp = s.user.xp + earned;
        const newRank = getRank(newXp);
        const wins = result === 'win' ? s.user.wins + 1 : s.user.wins;
        const losses = result === 'loss' ? s.user.losses + 1 : s.user.losses;
        return {
          battleActive: false,
          currentBattle: s.currentBattle ? {
            ...s.currentBattle,
            status: 'finished',
            result,
            xpEarned: earned,
          } : null,
          user: { ...s.user, xp: newXp, rank: newRank, wins, losses, totalSessions: s.user.totalSessions + 1 },
        };
      }),

      acceptChallenge: (id) => {
        const challenge = get().challenges.find(c => c.id === id);
        if (!challenge) return;
        const battle: Battle = {
          id: `battle_${Date.now()}`,
          opponentName: challenge.fromName,
          opponentUsername: challenge.fromUsername,
          opponentAvatar: challenge.fromAvatar,
          opponentRank: challenge.fromRank,
          duration: challenge.duration,
          myScore: 0,
          opponentScore: 0,
          status: 'active',
          startTime: Date.now(),
        };
        set((s) => ({ challenges: s.challenges.filter(c => c.id !== id) }));
        get().startBattle(battle);
      },

      declineChallenge: (id) => set((s) => ({ challenges: s.challenges.filter(c => c.id !== id) })),
    }),
    {
      name: 'grind-arena-store',
      partialize: (state: AppState) => ({ theme: state.theme, user: state.user }),
    } as any
  )
);

export { getRank, XP_THRESHOLDS, RANKS };
