import { useState } from 'react';
import { useStore } from '../store/useStore';
import { themes, Theme } from '../theme/themes';
import { ChevronRight, Check } from 'lucide-react';

const steps = [
  {
    emoji: '⚔️',
    title: 'Battle to Study',
    subtitle: 'Challenge classmates to timed focus sessions. The one who stays focused wins XP.',
  },
  {
    emoji: '🏆',
    title: 'Climb the Ranks',
    subtitle: 'Bronze → Legend. Rank decays if you go 3 days without a battle. Stay active.',
  },
  {
    emoji: '🛡️',
    title: 'Squad Up',
    subtitle: 'Join or create a squad. Team battles, shared XP, and no ghosting allowed.',
  },
];

const themeOptions: { id: Theme; name: string; emoji: string }[] = [
  { id: 'violet', name: 'Midnight Violet', emoji: '💜' },
  { id: 'ocean', name: 'Deep Ocean', emoji: '🌊' },
  { id: 'sunset', name: 'Sunset Fire', emoji: '🔥' },
  { id: 'mint', name: 'Neon Mint', emoji: '🌿' },
  { id: 'rose', name: 'Cherry Blossom', emoji: '🌸' },
  { id: 'amber', name: 'Golden Hour', emoji: '✨' },
];

export default function OnboardingScreen() {
  const { theme, setTheme, setScreen, setUser } = useStore();
  const t = themes[theme];
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [university, setUniversity] = useState('AUI');

  const next = () => {
    if (step < steps.length + 1) setStep(s => s + 1);
    else {
      // Finish onboarding
      setUser({ name: name || 'Grinder', university });
      setScreen('home');
    }
  };

  const finish = () => {
    setUser({ name: name || 'Grinder', university });
    setScreen('home');
  };

  // Theme picker step
  if (step === steps.length) {
    return (
      <div className="h-full w-full flex flex-col" style={{ background: t.bg }}>
        <div className="flex-1 flex flex-col px-6 pt-16 pb-6 gap-6 scroll-y">
          <div className="anim-fadeIn flex flex-col gap-2">
            <h2 className="text-3xl font-black" style={{ color: t.text }}>Pick your vibe 🎨</h2>
            <p style={{ color: t.textMuted }}>You can change this anytime in Settings</p>
          </div>

          <div className="grid grid-cols-2 gap-3 anim-slideUp anim-delay-1">
            {themeOptions.map((opt) => {
              const opt_t = themes[opt.id];
              const isSelected = theme === opt.id;
              return (
                <button
                  key={opt.id}
                  className="press-effect rounded-2xl p-4 flex flex-col gap-2 border-2 transition-all"
                  style={{
                    background: isSelected ? opt_t.cardGradient : opt_t.surface,
                    borderColor: isSelected ? opt_t.primary : 'transparent',
                    boxShadow: isSelected ? `0 0 20px ${opt_t.primaryGlow}` : 'none',
                  }}
                  onClick={() => setTheme(opt.id)}
                >
                  <div
                    className="w-full h-12 rounded-xl"
                    style={{ background: opt_t.gradient }}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold" style={{ color: opt_t.text }}>
                      {opt.emoji} {opt.name}
                    </span>
                    {isSelected && (
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: opt_t.primary }}
                      >
                        <Check size={12} color="#fff" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="anim-slideUp anim-delay-2 flex flex-col gap-3">
            <h3 className="text-lg font-bold" style={{ color: t.text }}>Your info</h3>
            <div
              className="rounded-2xl p-4 flex flex-col gap-3"
              style={{ background: t.surface, border: `1px solid ${t.border}` }}
            >
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: t.textMuted }}>
                  YOUR NAME
                </label>
                <input
                  className="w-full bg-transparent text-base font-medium outline-none"
                  style={{ color: t.text }}
                  placeholder="Enter your name..."
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
              <div style={{ height: 1, background: t.border }} />
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: t.textMuted }}>
                  UNIVERSITY
                </label>
                <select
                  className="w-full bg-transparent text-base font-medium outline-none"
                  style={{ color: t.text }}
                  value={university}
                  onChange={e => setUniversity(e.target.value)}
                >
                  {['AUI', 'ENSIAS', 'ENSA', 'UH2C', 'UM5', 'Other'].map(u => (
                    <option key={u} value={u} style={{ background: t.surface }}>{u}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 pb-10">
          <button
            className="press-effect w-full py-4 rounded-2xl font-bold text-lg"
            style={{ background: t.gradient, color: '#fff', boxShadow: `0 8px 30px ${t.primaryGlow}` }}
            onClick={finish}
          >
            Enter the Arena 🏟️
          </button>
        </div>
      </div>
    );
  }

  // Tutorial steps
  const currentStep = steps[step];

  return (
    <div className="h-full w-full flex flex-col" style={{ background: t.bg }}>
      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-8">
        {/* Progress dots */}
        <div className="flex gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === step ? 24 : 8,
                height: 8,
                background: i === step ? t.primary : t.border,
              }}
            />
          ))}
        </div>

        {/* Emoji */}
        <div
          className="anim-bounceIn w-32 h-32 rounded-3xl flex items-center justify-center text-6xl"
          key={step}
          style={{
            background: t.cardGradient,
            border: `2px solid ${t.border}`,
            boxShadow: `0 0 60px ${t.primaryGlow}`,
          }}
        >
          {currentStep.emoji}
        </div>

        {/* Text */}
        <div className="anim-fadeIn text-center flex flex-col gap-3" key={`text-${step}`}>
          <h2 className="text-3xl font-black" style={{ color: t.text }}>
            {currentStep.title}
          </h2>
          <p className="text-base leading-relaxed" style={{ color: t.textMuted }}>
            {currentStep.subtitle}
          </p>
        </div>
      </div>

      <div className="px-6 pb-10 flex flex-col gap-3">
        <button
          className="press-effect w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2"
          style={{ background: t.gradient, color: '#fff', boxShadow: `0 8px 30px ${t.primaryGlow}` }}
          onClick={next}
        >
          {step === steps.length - 1 ? 'Choose Your Style' : 'Next'}
          <ChevronRight size={20} strokeWidth={2.5} />
        </button>
        <button
          className="w-full py-2 text-sm font-medium"
          style={{ color: t.textMuted }}
          onClick={finish}
        >
          Skip setup
        </button>
      </div>
    </div>
  );
}
