import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { themes } from '../theme/themes';

export default function SplashScreen() {
  const { theme, setScreen } = useStore();
  const t = themes[theme];

  useEffect(() => {
    const timer = setTimeout(() => setScreen('onboarding'), 2200);
    return () => clearTimeout(timer);
  }, [setScreen]);

  return (
    <div
      className="h-full w-full flex flex-col items-center justify-center"
      style={{ background: t.bg }}
    >
      {/* Glowing orb behind logo */}
      <div
        className="absolute w-72 h-72 rounded-full opacity-20 blur-3xl"
        style={{ background: t.gradient }}
      />

      <div className="relative flex flex-col items-center gap-4 anim-bounceIn">
        {/* Logo mark */}
        <div
          className="w-24 h-24 rounded-3xl flex items-center justify-center text-5xl"
          style={{
            background: t.gradient,
            boxShadow: `0 0 60px ${t.primaryGlow}`,
          }}
        >
          ⚔️
        </div>

        <div className="flex flex-col items-center gap-1">
          <h1
            className="text-4xl font-black tracking-tight"
            style={{ color: t.text }}
          >
            Grind<span style={{ color: t.primary }}>Arena</span>
          </h1>
          <p className="text-sm font-medium" style={{ color: t.textMuted }}>
            Compete. Focus. Win.
          </p>
        </div>
      </div>

      {/* Loading dots */}
      <div className="absolute bottom-16 flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full"
            style={{
              background: t.primary,
              animation: `pulse-ring 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
