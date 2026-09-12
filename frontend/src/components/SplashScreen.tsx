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
    const inTimer = setTimeout(() => {
      setFadeIn(true);
      setProgress(100);
    }, 100);

    const outTimer = setTimeout(() => {
      setFadeOut(true);
    }, 4300);

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
      className={`fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center select-none overflow-hidden transition-opacity duration-700 ease-in-out ${
        fadeOut ? 'opacity-0 pointer-events-none' : fadeIn ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Center Branding — truly centered */}
      <div className="flex flex-col items-center text-center px-6">
        {/* Logo — bigger and properly centered */}
        <img
          src="/logo.png"
          alt="Azhagi Farm Milk"
          className="w-80 h-80 sm:w-96 sm:h-96 object-contain drop-shadow-2xl mb-4"
        />

        {/* Farm Name */}
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 mb-2">
          Azhagi Farm
        </h1>

        {/* Tagline */}
        <p className="text-sm sm:text-base font-semibold text-green-700 italic tracking-wide mb-5">
          "{TAGLINE}"
        </p>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 text-xs px-4 py-1.5 rounded-full shadow-sm">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
          <span className="font-semibold tracking-wide">Pure • Fresh • Farm Direct</span>
        </div>
      </div>

      {/* Progress bar — absolute at bottom so it doesn't shift centering */}
      <div className="absolute bottom-8 w-full max-w-xs flex flex-col items-center px-6">
        <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all ease-linear"
            style={{ width: `${progress}%`, transitionDuration: '4800ms' }}
          />
        </div>
        <p className="text-[11px] text-gray-400 font-semibold tracking-widest uppercase">
          Loading Your Farm Records...
        </p>
      </div>
    </div>
  );
}
