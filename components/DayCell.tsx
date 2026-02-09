
import React from 'react';
import { FishingDay } from '../types';

interface DayCellProps {
  day: number;
  data?: FishingDay;
  isSelected: boolean;
  onClick: () => void;
}

const DayCell: React.FC<DayCellProps> = ({ day, data, isSelected, onClick }) => {
  const getScoreColor = (score: number) => {
    // EPIC: 90%+ -> Vibrant Violet (Electric Purple)
    if (score >= 90) return 'bg-violet-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.6)] ring-2 ring-violet-300 z-10';
    if (score >= 85) return 'bg-violet-600 text-white shadow-[0_0_15px_rgba(139,92,246,0.3)] ring-1 ring-violet-400';
    
    // GOOD: 70-84% -> Emerald Green
    if (score >= 70) return 'bg-emerald-400 text-slate-950 shadow-[0_0_10px_rgba(52,211,153,0.2)]';
    
    // FAIR: 40-69% -> Amber
    if (score >= 50) return 'bg-amber-400 text-slate-950';
    if (score >= 40) return 'bg-amber-500/80 text-slate-900';
    
    // POOR: <40% -> Dark Slates
    if (score >= 25) return 'bg-slate-700 text-slate-300';
    if (score >= 10) return 'bg-slate-800 text-slate-500';
    return 'bg-slate-900 text-slate-600 opacity-60';
  };

  const getBorderState = () => {
    if (isSelected) return 'ring-4 ring-white ring-offset-2 ring-offset-slate-950 scale-110 z-30 shadow-2xl';
    return 'ring-1 ring-white/5';
  };

  return (
    <button
      onClick={onClick}
      className={`
        relative aspect-square w-full rounded-2xl flex flex-col items-center justify-center 
        transition-all duration-300 active:scale-75 touch-manipulation
        ${data ? getScoreColor(data.score) : 'bg-slate-950 text-slate-800 opacity-20'}
        ${getBorderState()}
      `}
    >
      <span className={`text-[8px] font-black absolute top-1.5 left-2 opacity-50`}>
        {day}
      </span>
      {data && (
        <span className="text-[11px] font-black mt-1.5 tracking-tighter">
          {data.score}%
        </span>
      )}
    </button>
  );
};

export default DayCell;
