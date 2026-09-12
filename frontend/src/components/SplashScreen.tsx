import { useState, useEffect } from 'react';
import { getInitialTheme } from '../lib/theme';

const TAGLINE = 'Fresh from Our Farm to Your Family';

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [fadeIn, setFadeIn] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark') || getInitialTheme() === 'dark';
    }
    return false;
  });

  useEffect(() => {
    // Detect theme accurately on mount
    const dark = document.documentElement.classList.contains('dark') || getInitialTheme() === 'dark';
    setIsDark(dark);

    const inTimer = setTimeout(() => {
      setFadeIn(true);
      setProgress(100);
    }, 100);
    const outTimer = setTimeout(() => setFadeOut(true), 4300);
    const completeTimer = setTimeout(() => onComplete(), 5000);
    return () => {
      clearTimeout(inTimer);
      clearTimeout(outTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center select-none overflow-hidden transition-opacity duration-700 ease-in-out ${
        fadeOut ? 'opacity-0 pointer-events-none' : fadeIn ? 'opacity-100' : 'opacity-0'
      }`}
      style={{
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
      }}
    >
      {/* Center Branding Container */}
      <div className="flex flex-col items-center text-center px-6 max-w-sm sm:max-w-md">

        {/* Brand Logo — clean transparent PNG, size increased, no grid box */}
        <div className="relative mb-3 sm:mb-4">
          <img
            src="/logo.png"
            alt="Azhagi Farm Milk"
            className="w-72 h-72 sm:w-80 sm:h-80 md:w-88 md:h-88 object-contain transition-transform duration-500 hover:scale-105"
            style={{
              filter: isDark
                ? 'drop-shadow(0 12px 28px rgba(0,0,0,0.55)) drop-shadow(0 0 20px rgba(16,185,129,0.15))'
                : 'drop-shadow(0 10px 24px rgba(0,0,0,0.12))',
            }}
          />
        </div>

        {/* Farm Name — Guaranteed contrast for both themes */}
        <h1
          className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-1.5"
          style={{ color: isDark ? '#ffffff' : '#0f172a' }}
        >
          Azhagi Farm
        </h1>

        {/* Farm Tagline */}
        <p
          className="text-sm sm:text-base font-semibold italic tracking-wide mb-3 sm:mb-4"
          style={{ color: isDark ? '#34d399' : '#047857' }}
        >
          "{TAGLINE}"
        </p>

        {/* Farm Direct Badge */}
        <div
          className="inline-flex items-center gap-2 text-xs px-4 py-1.5 rounded-full border shadow-xs"
          style={{
            backgroundColor: isDark ? 'rgba(6, 78, 59, 0.5)' : '#ecfdf5',
            borderColor: isDark ? '#065f46' : '#a7f3d0',
            color: isDark ? '#6ee7b7' : '#065f46',
          }}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span className="font-semibold tracking-wide">Pure • Fresh • Farm Direct</span>
        </div>
      </div>

      {/* Bottom Progress Bar — pinned to bottom, theme-aware */}
      <div className="absolute bottom-8 sm:bottom-10 w-full max-w-xs flex flex-col items-center px-6">
        <div
          className="w-full h-1.5 rounded-full overflow-hidden mb-2.5"
          style={{ backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }}
        >
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-green-400 rounded-full transition-all ease-linear"
            style={{ width: `${progress}%`, transitionDuration: '4800ms' }}
          />
        </div>
        <p
          className="text-[11px] font-semibold tracking-widest uppercase"
          style={{ color: isDark ? '#94a3b8' : '#64748b' }}
        >
          Loading Your Farm Records...
        </p>
      </div>
    </div>
  );
}
