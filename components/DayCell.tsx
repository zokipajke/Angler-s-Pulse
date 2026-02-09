
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
    if (score >= 90) return 'bg-cyan-400 text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.6)] ring-2 ring-cyan-200 z-10';
    if (score >= 80) return 'bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(34,211,238,0.3)] ring-1 ring-cyan-300';
    if (score >= 70) return 'bg-emerald-400 text-slate-950 shadow-[0_0_10px_rgba(52,211,153,0.2)]';
    if (score >= 50) return 'bg-amber-400 text-slate-950';
    if (score >= 30) return 'bg-slate-700 text-slate-300';
    if (score >= 15) return 'bg-slate-800 text-slate-500';
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
