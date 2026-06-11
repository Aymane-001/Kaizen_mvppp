import { useEffect } from 'react';
import { useStore } from './store/useStore';
import { themes } from './theme/themes';

import SplashScreen from './screens/SplashScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import HomeScreen from './screens/HomeScreen';
import BattleScreen from './screens/BattleScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';
import ChallengesScreen from './screens/ChallengesScreen';
import SquadScreen from './screens/SquadScreen';
import ProfileScreen from './screens/ProfileScreen';
import SettingsScreen from './screens/SettingsScreen';
import BottomNav from './components/BottomNav';

const NAV_SCREENS = ['home', 'leaderboard', 'challenges', 'squad', 'profile'];

export default function App() {
  const { screen, theme } = useStore();
  const t = themes[theme];

  // Apply CSS variables for global theme
  useEffect(() => {
    document.documentElement.style.setProperty('--bg', t.bg);
    document.documentElement.style.setProperty('--primary', t.primary);
    document.documentElement.style.setProperty('--glow', t.primaryGlow);
    document.body.style.background = t.bg;
  }, [theme, t]);

  const showNav = NAV_SCREENS.includes(screen);

  return (
    <div
      className="relative w-full h-full flex flex-col overflow-hidden"
      style={{
        background: t.bg,
        maxWidth: 430,
        margin: '0 auto',
        // Mobile frame shadow on desktop
        boxShadow: window.innerWidth > 430 ? '0 0 60px rgba(0,0,0,0.8)' : 'none',
      }}
    >
      {/* Main content area */}
      <div className="flex-1 overflow-hidden relative">
        {screen === 'splash' && <SplashScreen />}
        {screen === 'onboarding' && <OnboardingScreen />}
        {screen === 'home' && <HomeScreen />}
        {screen === 'battle' && <BattleScreen />}
        {screen === 'leaderboard' && <LeaderboardScreen />}
        {screen === 'challenges' && <ChallengesScreen />}
        {screen === 'squad' && <SquadScreen />}
        {screen === 'profile' && <ProfileScreen />}
        {screen === 'settings' && <SettingsScreen />}
      </div>

      {/* Bottom nav */}
      {showNav && <BottomNav />}
    </div>
  );
}
