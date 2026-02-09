
import React from 'react';

export const FishIcon = ({ className = "w-6 h-6" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M22 12s-4-4-10-4S2 12 2 12s4 4 10 4 10-4 10-4zm-13 0a3 3 0 106 0 3 3 0 00-6 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M22 12c-2.5 2.5-2.5-2.5-2.5-2.5M19.5 12h.5" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1-2-3-3-5-3M12 16c-1 2-3 3-5 3" />
  </svg>
);

export const ChevronLeft = ({ className = "w-6 h-6" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

export const ChevronRight = ({ className = "w-6 h-6" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

export const MoonIcon = ({ className = "w-6 h-6" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
  </svg>
);

/**
 * Renders an accurate visual representation of the moon phase.
 * phase: 0 (New Moon) -> 0.25 (First Quarter) -> 0.5 (Full Moon) -> 0.75 (Last Quarter) -> 1.0 (New Moon)
 */
export const MoonPhaseVisual = ({ phase, className = "w-16 h-16" }: { phase: number, className?: string }) => {
  // We'll use a simple CSS/SVG trick: 
  // Two hemispheres and a middle oval that changes width and color.
  const isWaning = phase > 0.5;
  const absPhase = phase > 0.5 ? 1 - phase : phase; // 0 to 0.5
  const percentage = absPhase * 2; // 0 to 1 scale for half-cycle
  
  // Determine if the middle oval is "adding" light or "subtracting" it
  const isCrescent = percentage < 0.5;
  const ovalWidth = Math.abs(1 - percentage * 2);

  return (
    <div className={`${className} relative flex items-center justify-center`}>
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
        {/* Background (The dark part of the moon) */}
        <circle cx="50" cy="50" r="45" className="fill-slate-800" />
        
        <defs>
          <clipPath id="leftHalf">
            <rect x="0" y="0" width="50" height="100" />
          </clipPath>
          <clipPath id="rightHalf">
            <rect x="50" y="0" width="50" height="100" />
          </clipPath>
        </defs>

        {/* Base light hemisphere */}
        <circle 
          cx="50" cy="50" r="45" 
          className="fill-slate-100" 
          clipPath={isWaning ? "url(#leftHalf)" : "url(#rightHalf)"} 
        />

        {/* The transition ellipse */}
        <ellipse
          cx="50" cy="50"
          rx={45 * ovalWidth}
          ry="45"
          className={isCrescent ? "fill-slate-800" : "fill-slate-100"}
        />
      </svg>
    </div>
  );
};

export const InfoIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export const RefreshIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

export const WindDirectionIcon = ({ direction, className = "w-9 h-9" }: { direction: string, className?: string }) => (
  <div className={`${className} flex items-center justify-center font-black border-2 border-current rounded-full uppercase tracking-tighter leading-none transition-all`}>
    <span className={`${direction.length > 2 ? 'text-[7px]' : 'text-[10px]'} text-current text-center px-0.5`}>
      {direction}
    </span>
  </div>
);

export const ThermometerIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

export const PressureTrendIcon = ({ trend, className = "w-5 h-5" }: { trend: string, className?: string }) => {
  if (trend === 'rising') {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M7 17L17 7M17 7H11M17 7V13" />
      </svg>
    );
  }
  if (trend === 'falling') {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M7 7L17 17M17 17H11M17 17V11" />
      </svg>
    );
  }
  // Steady / Equal
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 9h16M4 15h16" />
    </svg>
  );
};

export const CloudRainIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 16v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h2m4 0h4a2 2 0 012 2v1m-6 4l-3 3m0 0l-3-3m3 3V10" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 10a4 4 0 00-4-4h-1a5 5 0 00-9.78 2.096A4.001 4.001 0 003 15a4 4 0 004 4h9a5 5 0 00.1-9.999" />
  </svg>
);
