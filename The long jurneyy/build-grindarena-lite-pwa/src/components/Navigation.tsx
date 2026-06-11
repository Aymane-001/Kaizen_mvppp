import { useStore } from '../lib/store';
import { getTheme } from '../lib/theme';
import { Zap, Swords, Trophy, User } from 'lucide-react';

const TABS = [
  { key: 'focus',       label: 'Focus',       icon: Zap },
  { key: 'battles',     label: 'Battles',     icon: Swords },
  { key: 'leaderboard', label: 'Ranks',        icon: Trophy },
  { key: 'profile',     label: 'Profile',     icon: User },
] as const;

export function Navigation() {
  const { activeScreen, setScreen, themeColor, themeMode, battleInvites } = useStore();
  const t = getTheme(themeColor, themeMode);

  return (
    <nav className={`fixed bottom-0 left-0 right-0 ${t.navBg} border-t ${t.border} z-30 safe-bottom`}>
      <div className="flex items-stretch">
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = activeScreen === key;
          const hasBadge = key === 'battles' && battleInvites.length > 0;
          return (
            <button
              key={key}
              onClick={() => setScreen(key as typeof activeScreen)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-3 transition-all
                ${active ? t.navActive : t.navText}`}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                {hasBadge && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />
                )}
              </div>
              <span className={`text-[10px] font-semibold ${active ? '' : ''}`}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
