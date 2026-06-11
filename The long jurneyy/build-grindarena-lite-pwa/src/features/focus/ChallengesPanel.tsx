import { useStore } from '../../lib/store';
import { getTheme } from '../../lib/theme';
import { Trophy } from 'lucide-react';

interface Props {
  t: ReturnType<typeof getTheme>;
  compact?: boolean;
}

export function ChallengesPanel({ t, compact = false }: Props) {
  const { challenges } = useStore();
  const active = challenges.filter((c) => !c.completed);
  const display = compact ? active.slice(0, 2) : active;

  if (display.length === 0) {
    return (
      <div className={`w-full max-w-xs ${t.bgCard} ${t.border} border rounded-xl p-4 text-center`}>
        <Trophy size={20} className="mx-auto mb-2 text-amber-400" />
        <p className={`text-sm ${t.textMuted}`}>All challenges complete! 🎉</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xs space-y-2">
      <p className={`text-xs font-semibold ${t.textMuted} uppercase tracking-wide`}>
        Monthly Challenges
      </p>
      {display.map((c) => {
        const pct = Math.min((c.progress / c.goal) * 100, 100);
        return (
          <div key={c.id} className={`${t.bgCard} ${t.border} border rounded-xl p-3`}>
            <div className="flex items-start justify-between mb-2">
              <p className={`text-xs font-medium ${t.text} leading-tight flex-1 pr-2`}>{c.title}</p>
              <span className={`text-xs font-bold ${t.accentText} shrink-0`}>+{c.rewardXp} XP</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`flex-1 h-1.5 ${t.bgInput} rounded-full overflow-hidden`}>
                <div
                  className={`h-full ${t.xpBar} rounded-full transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className={`text-xs ${t.textMuted} shrink-0`}>
                {c.progress}/{c.goal}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
