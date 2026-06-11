import { useStore } from '../store/useStore';
import { themes, Theme } from '../theme/themes';
import { ChevronLeft, Check, Bell, Shield, Info } from 'lucide-react';

const themeOptions: { id: Theme; name: string; emoji: string }[] = [
  { id: 'violet', name: 'Midnight Violet', emoji: '💜' },
  { id: 'ocean', name: 'Deep Ocean', emoji: '🌊' },
  { id: 'sunset', name: 'Sunset Fire', emoji: '🔥' },
  { id: 'mint', name: 'Neon Mint', emoji: '🌿' },
  { id: 'rose', name: 'Cherry Blossom', emoji: '🌸' },
  { id: 'amber', name: 'Golden Hour', emoji: '✨' },
];

export default function SettingsScreen() {
  const { theme, setTheme, setScreen } = useStore();
  const t = themes[theme];

  return (
    <div className="h-full w-full flex flex-col" style={{ background: t.bg }}>
      {/* Header */}
      <div
        className="px-5 pt-12 pb-4 flex items-center gap-3"
        style={{ background: t.surface, borderBottom: `1px solid ${t.border}` }}
      >
        <button
          className="press-effect w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: t.border }}
          onClick={() => setScreen('profile')}
        >
          <ChevronLeft size={20} style={{ color: t.text }} />
        </button>
        <h1 className="text-xl font-black" style={{ color: t.text }}>Settings</h1>
      </div>

      <div className="flex-1 scroll-y px-5 py-4 flex flex-col gap-5">

        {/* Theme */}
        <div className="flex flex-col gap-3">
          <p className="text-sm font-bold" style={{ color: t.textMuted }}>🎨 COLOR THEME</p>
          <div className="grid grid-cols-2 gap-3">
            {themeOptions.map((opt) => {
              const opt_t = themes[opt.id];
              const isSelected = theme === opt.id;
              return (
                <button
                  key={opt.id}
                  className="press-effect rounded-2xl p-3 flex flex-col gap-2 border-2 transition-all"
                  style={{
                    background: isSelected ? opt_t.cardGradient : opt_t.surface,
                    borderColor: isSelected ? opt_t.primary : 'transparent',
                    boxShadow: isSelected ? `0 0 16px ${opt_t.primaryGlow}` : 'none',
                  }}
                  onClick={() => setTheme(opt.id)}
                >
                  <div className="w-full h-8 rounded-xl" style={{ background: opt_t.gradient }} />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold" style={{ color: opt_t.text }}>
                      {opt.emoji} {opt.name}
                    </span>
                    {isSelected && (
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: opt_t.primary }}
                      >
                        <Check size={11} color="#fff" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Notifications */}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold" style={{ color: t.textMuted }}>🔔 NOTIFICATIONS</p>
          {[
            { label: 'Challenge Requests', subtitle: 'Get notified when someone challenges you', on: true },
            { label: 'Rank Decay Warning', subtitle: '24h warning before rank drops', on: true },
            { label: 'Squad Battles', subtitle: 'When your squad has an upcoming battle', on: true },
            { label: 'Weekly Summary', subtitle: 'Your focus stats every Monday', on: false },
          ].map(({ label, subtitle, on }) => (
            <div
              key={label}
              className="rounded-2xl p-4 flex items-center gap-3"
              style={{ background: t.surface, border: `1px solid ${t.border}` }}
            >
              <Bell size={18} style={{ color: t.primary }} />
              <div className="flex-1">
                <p className="text-sm font-bold" style={{ color: t.text }}>{label}</p>
                <p className="text-xs" style={{ color: t.textMuted }}>{subtitle}</p>
              </div>
              {/* Toggle */}
              <div
                className="w-12 h-6 rounded-full relative transition-all"
                style={{ background: on ? t.primary : t.border }}
              >
                <div
                  className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
                  style={{ left: on ? 'calc(100% - 20px)' : '4px' }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Privacy */}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold" style={{ color: t.textMuted }}>🔒 PRIVACY</p>
          {[
            { label: 'Show on Leaderboard', on: true },
            { label: 'Show Streak', on: true },
            { label: 'Allow Challenges from Anyone', on: false },
          ].map(({ label, on }) => (
            <div
              key={label}
              className="rounded-2xl p-4 flex items-center gap-3"
              style={{ background: t.surface, border: `1px solid ${t.border}` }}
            >
              <Shield size={18} style={{ color: t.primary }} />
              <p className="flex-1 text-sm font-bold" style={{ color: t.text }}>{label}</p>
              <div
                className="w-12 h-6 rounded-full relative"
                style={{ background: on ? t.primary : t.border }}
              >
                <div
                  className="absolute top-1 w-4 h-4 rounded-full bg-white"
                  style={{ left: on ? 'calc(100% - 20px)' : '4px' }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* About */}
        <div
          className="rounded-2xl p-4 flex items-center gap-3"
          style={{ background: t.surface, border: `1px solid ${t.border}` }}
        >
          <Info size={18} style={{ color: t.textMuted }} />
          <div className="flex-1">
            <p className="text-sm font-bold" style={{ color: t.text }}>GrindArena v1.0</p>
            <p className="text-xs" style={{ color: t.textMuted }}>Built at AUI · Season 1</p>
          </div>
        </div>

        <div className="h-4" />
      </div>
    </div>
  );
}
