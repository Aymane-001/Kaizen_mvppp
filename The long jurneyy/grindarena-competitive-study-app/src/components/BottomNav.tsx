import { useStore } from '../store/useStore';
import { themes } from '../theme/themes';
import { Home, Trophy, Users, User, Swords } from 'lucide-react';

const navItems = [
  { screen: 'home', icon: Home, label: 'Arena' },
  { screen: 'leaderboard', icon: Trophy, label: 'Ranks' },
  { screen: 'challenges', icon: Swords, label: 'Battle' },
  { screen: 'squad', icon: Users, label: 'Squad' },
  { screen: 'profile', icon: User, label: 'You' },
] as const;

export default function BottomNav() {
  const { theme, screen, setScreen, challenges } = useStore();
  const t = themes[theme];

  return (
    <div
      className="safe-bottom flex items-center justify-around pt-2 pb-1"
      style={{
        background: t.surface,
        borderTop: `1px solid ${t.border}`,
      }}
    >
      {navItems.map(({ screen: s, icon: Icon, label }) => {
        const isActive = screen === s;
        const hasBadge = s === 'challenges' && challenges.length > 0;

        return (
          <button
            key={s}
            className="press-effect flex flex-col items-center gap-1 px-4 py-1 relative"
            onClick={() => setScreen(s as any)}
          >
            {/* Active indicator */}
            {isActive && (
              <div
                className="absolute -top-2 w-8 h-1 rounded-b-full"
                style={{ background: t.gradient }}
              />
            )}

            <div
              className="w-8 h-8 flex items-center justify-center rounded-xl relative"
              style={{
                background: isActive ? t.pill : 'transparent',
              }}
            >
              <Icon
                size={20}
                style={{ color: isActive ? t.primary : t.textMuted }}
                strokeWidth={isActive ? 2.5 : 2}
              />
              {hasBadge && (
                <div
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: t.loss, color: '#fff', fontSize: 9 }}
                >
                  {challenges.length}
                </div>
              )}
            </div>
            <span
              className="text-xs font-semibold"
              style={{ color: isActive ? t.primary : t.textMuted }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
