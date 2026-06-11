import { useState } from 'react';
import { useStore, ThemeColor, ThemeMode, Tier } from '../../lib/store';
import { getTheme } from '../../lib/theme';
import { THEME_NAMES, THEME_SWATCHES } from '../../lib/theme';
import { ChallengesPanel } from '../focus/ChallengesPanel';
import { Flame, Star, Clock, Zap, Sun, Moon } from 'lucide-react';

function TierInfo({ tier }: { tier: Tier }) {
  const config = {
    Bronze: { emoji: '🥉', label: 'Bronze', next: 'Silver', nextXp: 1500, color: 'text-orange-400' },
    Silver: { emoji: '🥈', label: 'Silver', next: 'Gold', nextXp: 5000, color: 'text-slate-300' },
    Gold:   { emoji: '🥇', label: 'Gold', next: null, nextXp: null, color: 'text-amber-400' },
  }[tier];
  return (
    <div className="flex items-center gap-2">
      <span className="text-2xl">{config.emoji}</span>
      <div>
        <p className={`font-bold text-sm ${config.color}`}>{config.label}</p>
        {config.next && <p className="text-xs text-slate-500">{config.nextXp?.toLocaleString()} XP → {config.next}</p>}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, t }: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  t: ReturnType<typeof getTheme>;
}) {
  return (
    <div className={`${t.bgCard} ${t.border} border rounded-2xl p-4 flex items-center gap-3`}>
      <div className={`w-10 h-10 rounded-xl ${t.accentLight} flex items-center justify-center ${t.accentText}`}>
        {icon}
      </div>
      <div>
        <p className={`text-xs ${t.textMuted}`}>{label}</p>
        <p className={`text-lg font-black ${t.text}`}>{value}</p>
      </div>
    </div>
  );
}

const COLORS: ThemeColor[] = ['blue', 'green', 'orange', 'red', 'purple', 'neutral'];

export function ProfileScreen() {
  const {
    userName, setUserName, totalXp, streak, sessionHistory,
    themeColor, themeMode, setTheme, initChallenges,
    userId, generateInvite,
  } = useStore();
  const t = getTheme(themeColor, themeMode);

  const [nameInput, setNameInput] = useState(userName);
  const [editing, setEditing] = useState(false);

  const tier: Tier = totalXp >= 5000 ? 'Gold' : totalXp >= 1500 ? 'Silver' : 'Bronze';
  const sessionsCompleted = sessionHistory.length;
  const totalMins = sessionHistory.reduce((a, s) => a + s.duration, 0);

  const handleSaveName = () => {
    setUserName(nameInput.trim() || 'Anonymous');
    setEditing(false);
  };

  const handleThemeColor = (c: ThemeColor) => setTheme(c, themeMode);
  const handleThemeMode = (m: ThemeMode) => setTheme(themeColor, m);

  return (
    <div className={`min-h-screen ${t.bg} pb-20`}>
      <div className="px-4 pt-6 space-y-5">
        <h1 className={`text-2xl font-black ${t.text}`}>Profile</h1>

        {/* User Card */}
        <div className={`${t.bgCard} ${t.border} border rounded-2xl p-5 space-y-3`}>
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-2xl ${t.accent} flex items-center justify-center text-2xl font-black ${t.textInverse}`}>
              {(userName || 'A').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              {editing ? (
                <div className="flex gap-2">
                  <input
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                    className={`flex-1 px-3 py-2 rounded-xl text-sm ${t.bgInput} ${t.text} ${t.border} border outline-none focus:ring-2 ${t.accentRing}`}
                    placeholder="Your name"
                    maxLength={20}
                    autoFocus
                  />
                  <button
                    onClick={handleSaveName}
                    className={`px-3 py-2 rounded-xl text-sm font-bold ${t.accent} ${t.textInverse}`}
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div>
                  <p className={`text-xl font-black ${t.text}`}>{userName || 'Anonymous'}</p>
                  <button
                    onClick={() => setEditing(true)}
                    className={`text-xs ${t.accentText} mt-0.5`}
                  >
                    Edit name
                  </button>
                </div>
              )}
              <div className="mt-1">
                <TierInfo tier={tier} />
              </div>
            </div>
          </div>

          {/* XP Bar to next tier */}
          {tier !== 'Gold' && (
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className={t.textMuted}>XP Progress</span>
                <span className={t.accentText}>{Math.floor(totalXp).toLocaleString()} / {tier === 'Bronze' ? '1,500' : '5,000'}</span>
              </div>
              <div className={`h-2 ${t.bgInput} rounded-full overflow-hidden`}>
                <div
                  className={`h-full ${t.xpBar} rounded-full transition-all`}
                  style={{ width: `${Math.min((totalXp / (tier === 'Bronze' ? 1500 : 5000)) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Total XP" value={Math.floor(totalXp).toLocaleString()} icon={<Star size={18} />} t={t} />
          <StatCard label="Day Streak" value={`${streak}d`} icon={<Flame size={18} />} t={t} />
          <StatCard label="Total Focus" value={`${totalMins}m`} icon={<Clock size={18} />} t={t} />
          <StatCard label="Sessions" value={sessionsCompleted} icon={<Zap size={18} />} t={t} />
        </div>

        {/* Session History */}
        {sessionHistory.length > 0 && (
          <div>
            <h2 className={`text-sm font-bold ${t.textMuted} uppercase tracking-wide mb-3`}>Last 5 Sessions</h2>
            <div className="space-y-2">
              {sessionHistory.map((s) => (
                <div key={s.id} className={`${t.bgCard} ${t.border} border rounded-xl px-4 py-3 flex items-center justify-between`}>
                  <div>
                    <p className={`text-sm font-semibold ${t.text}`}>{s.duration}m session</p>
                    <p className={`text-xs ${t.textMuted}`}>
                      {s.mode === 'camera' ? '📷' : '⌨️'} {new Date(s.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`text-sm font-bold ${t.accentText}`}>+{s.xp} XP</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Challenges */}
        <div>
          <h2 className={`text-sm font-bold ${t.textMuted} uppercase tracking-wide mb-3`}>Monthly Challenges</h2>
          <ChallengesPanel t={t} />
        </div>

        {/* Theme Section */}
        <div className={`${t.bgCard} ${t.border} border rounded-2xl p-4 space-y-4`}>
          <h2 className={`font-bold text-base ${t.text}`}>Theme</h2>

          {/* Light / Dark */}
          <div>
            <p className={`text-xs ${t.textMuted} mb-2`}>Mode</p>
            <div className={`flex ${t.bgInput} rounded-xl p-1 gap-1`}>
              <button
                onClick={() => handleThemeMode('light')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all
                  ${themeMode === 'light' ? `${t.accent} ${t.textInverse}` : `${t.textMuted}`}`}
              >
                <Sun size={14} /> Light
              </button>
              <button
                onClick={() => handleThemeMode('dark')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all
                  ${themeMode === 'dark' ? `${t.accent} ${t.textInverse}` : `${t.textMuted}`}`}
              >
                <Moon size={14} /> Dark
              </button>
            </div>
          </div>

          {/* Color Picker */}
          <div>
            <p className={`text-xs ${t.textMuted} mb-3`}>Color</p>
            <div className="grid grid-cols-3 gap-2">
              {COLORS.map((c) => {
                const swatch = THEME_SWATCHES[c];
                const isActive = themeColor === c;
                return (
                  <button
                    key={c}
                    onClick={() => handleThemeColor(c)}
                    className={`py-3 px-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all border-2
                      ${isActive ? 'border-current opacity-100 scale-[1.02]' : 'border-transparent opacity-70'}`}
                    style={{
                      background: themeMode === 'dark' ? swatch.dark : swatch.light,
                      color: themeMode === 'dark' ? '#f1f5f9' : '#1e293b',
                      borderColor: isActive ? (themeMode === 'dark' ? '#94a3b8' : '#64748b') : 'transparent',
                    }}
                  >
                    <span className="w-3 h-3 rounded-full shrink-0" style={{
                      background: themeMode === 'dark' ? swatch.light : swatch.dark,
                    }} />
                    <span className="truncate">{THEME_NAMES[c]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Debug / Test Actions */}
        <div className={`${t.bgCard} ${t.border} border rounded-2xl p-4 space-y-3`}>
          <h2 className={`font-bold text-sm ${t.text}`}>Test Retention</h2>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={generateInvite}
              className={`py-2.5 rounded-xl text-xs font-semibold ${t.accentLight} ${t.accentText} border ${t.border}`}
            >
              🗡 Simulate Invite
            </button>
            <button
              onClick={initChallenges}
              className={`py-2.5 rounded-xl text-xs font-semibold ${t.accentLight} ${t.accentText} border ${t.border}`}
            >
              🔄 Reset Challenges
            </button>
          </div>
          <p className={`text-xs ${t.textMuted} text-center`}>ID: {userId.slice(0, 8)}…</p>
        </div>
      </div>
    </div>
  );
}
