import { useEffect } from 'react';
import { useStore } from './lib/store';
import { getTheme } from './lib/theme';
import { Navigation } from './components/Navigation';
import { FocusScreen } from './features/focus/FocusScreen';
import { BattlesScreen } from './features/battles/BattlesScreen';
import { LeaderboardScreen } from './features/leaderboard/LeaderboardScreen';
import { ProfileScreen } from './features/profile/ProfileScreen';

export default function App() {
  const { activeScreen, themeColor, themeMode, initChallenges, checkDecay, refreshLeaderboard } = useStore();
  const t = getTheme(themeColor, themeMode);

  // Boot sequence
  useEffect(() => {
    initChallenges();
    checkDecay();
    refreshLeaderboard();
  }, [initChallenges, checkDecay, refreshLeaderboard]);

  const screen = {
    focus: <FocusScreen />,
    battles: <BattlesScreen />,
    leaderboard: <LeaderboardScreen />,
    profile: <ProfileScreen />,
  }[activeScreen];

  return (
    <div className={`${t.bg} min-h-screen`}>
      {screen}
      <Navigation />
    </div>
  );
}
