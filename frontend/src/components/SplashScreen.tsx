import { useState, useEffect } from 'react';

const TAGLINE = 'Fresh from Our Farm to Your Family';

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [fadeIn, setFadeIn] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // 1. Smooth fade-in
    const inTimer = setTimeout(() => {
      setFadeIn(true);
      setProgress(100);
    }, 100);

    // 2. Begin fade-out at 4.3 seconds
    const outTimer = setTimeout(() => {
      setFadeOut(true);
    }, 4300);

    // 3. Fully complete and unmount at 5.0 seconds
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 5000);

    return () => {
      clearTimeout(inTimer);
      clearTimeout(outTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-between p-6 sm:p-10 select-none overflow-hidden transition-opacity duration-700 ease-in-out ${
        fadeOut ? 'opacity-0 pointer-events-none' : fadeIn ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Top spacer */}
      <div className="w-full h-8" />

      {/* Center Branding Content on Static White */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-sm px-4">
        {/* Official Farm Logo */}
        <div className="relative mb-6">
          <div className="bg-white p-3 sm:p-4 rounded-3xl shadow-xl border border-green-100 ring-4 ring-green-50">
            <img
              src="/logo.png"
              alt="Azhagi Farm Milk"
              className="w-32 h-32 sm:w-36 sm:h-36 object-contain rounded-2xl"
            />
          </div>
        </div>

        {/* Farm Name */}
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 mb-2">
          Azhagi Farm
        </h1>

        {/* Official Tagline */}
        <p className="text-sm sm:text-base font-semibold text-green-700 italic tracking-wide mb-4">
          "{TAGLINE}"
        </p>

        {/* Farm Nature Badge */}
        <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 text-xs px-4 py-1.5 rounded-full shadow-xs">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
          <span className="font-semibold tracking-wide">Pure • Fresh • Farm Direct</span>
        </div>
      </div>

      {/* Bottom Progress Bar */}
      <div className="relative z-10 w-full max-w-xs flex flex-col items-center mb-4">
        <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all ease-linear"
            style={{
              width: `${progress}%`,
              transitionDuration: '4800ms',
            }}
          />
        </div>
        <p className="text-[11px] text-gray-400 font-semibold tracking-widest uppercase">
          Loading Your Farm Records...
        </p>
      </div>
    </div>
  );
}
