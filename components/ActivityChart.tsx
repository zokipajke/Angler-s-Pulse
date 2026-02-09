import React, { useState, useEffect } from 'react';
import { FishingDay } from '../types';

interface ActivityChartProps {
  day: FishingDay;
  isToday?: boolean;
}

const ActivityChart: React.FC<ActivityChartProps> = ({ day, isToday }) => {
  const [currentHour, setCurrentHour] = useState(() => {
    const now = new Date();
    return now.getHours() + now.getMinutes() / 60;
  });

  useEffect(() => {
    if (!isToday) return;
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentHour(now.getHours() + now.getMinutes() / 60);
    }, 60000);
    return () => clearInterval(interval);
  }, [isToday]);

  const data = day.hourlyActivity;
  const maxVal = 100;
  const width = 400;
  
  // Refined Layout Constants for Vertical Stretching
  const padding = 15;
  const activityHeight = 180;   // Increased from 120
  const labelSpace = 35;        // Middle gap for labels
  const transitionHeight = 110; // Increased from 70
  const totalHeight = activityHeight + labelSpace + transitionHeight;

  const getX = (hour: number) => (hour / 23.99) * (width - 2 * padding) + padding;
  
  // Activity Y Mapping: Utilize activityHeight fully
  const getYActivity = (val: number) => (activityHeight - padding) - (val / maxVal) * (activityHeight - 2 * padding);

  // Transition Chart Calculations
  const transitionStart = activityHeight + labelSpace;
  const transitionBaselineY = transitionStart + (transitionHeight / 2);
  const transitionAmplitude = (transitionHeight / 2) - 10;

  const points = data.map((v, i) => ({ x: getX(i), y: getYActivity(v) }));

  const getCurvePath = (pts: { x: number, y: number }[]) => {
    if (pts.length < 2) return "";
    const bezierCommand = (point: { x: number, y: number }, i: number, a: { x: number, y: number }[]) => {
      const cp = (current: { x: number, y: number }, previous: { x: number, y: number }, next: { x: number, y: number }, reverse: boolean) => {
        const p = previous || current;
        const n = next || current;
        const smoothing = 0.15;
        const lengthX = n.x - p.x;
        const lengthY = n.y - p.y;
        const angle = Math.atan2(lengthY, lengthX);
        const distance = Math.sqrt(Math.pow(lengthX, 2) + Math.pow(lengthY, 2)) * smoothing;
        const x = current.x + Math.cos(angle + (reverse ? Math.PI : 0)) * distance;
        const y = current.y + Math.sin(angle + (reverse ? Math.PI : 0)) * distance;
        return [x, y];
      };
      const [cpsX, cpsY] = cp(a[i - 1], a[i - 2], point, false);
      const [cpeX, cpeY] = cp(point, a[i - 1], a[i + 1], true);
      return `C ${cpsX},${cpsY} ${cpeX},${cpeY} ${point.x},${point.y}`;
    };
    return pts.reduce((acc, point, i, a) => 
      i === 0 ? `M ${point.x},${point.y}` : `${acc} ${bezierCommand(point, i, a)}`
    , "");
  };

  const linePath = getCurvePath(points);
  // Close the area path at the bottom of the activity chart section
  const areaPath = `${linePath} L ${getX(23.99)},${activityHeight - padding} L ${getX(0)},${activityHeight - padding} Z`;

  const strokeColor = '#60a5fa'; // tailwind blue-400
  const curveFillColor = 'url(#blueGradient)';

  const timeToHour = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h + m / 60;
  };

  const sunriseHour = day.events.find(e => e.type === 'sunrise')?.time ? timeToHour(day.events.find(e => e.type === 'sunrise')!.time) : 6;
  const sunsetHour = day.events.find(e => e.type === 'sunset')?.time ? timeToHour(day.events.find(e => e.type === 'sunset')!.time) : 18;
  const solarNoon = (sunriseHour + sunsetHour) / 2;
  const moonTransitHour = (solarNoon + (day.moonPhaseValue * 24)) % 24;

  const getSunY = (h: number) => {
    if (h < sunriseHour || h > sunsetHour) return transitionBaselineY;
    const dayLength = sunsetHour - sunriseHour;
    const normalized = (h - sunriseHour) / dayLength;
    const val = Math.sin(normalized * Math.PI);
    return transitionBaselineY - val * transitionAmplitude;
  };

  const generateSunPath = () => {
    let d = `M ${getX(sunriseHour)} ${transitionBaselineY}`;
    const step = 0.1;
    for (let h = sunriseHour; h <= sunsetHour; h += step) {
      d += ` L ${getX(Math.min(h, 23.99))} ${getSunY(h)}`;
    }
    d += ` L ${getX(sunsetHour)} ${transitionBaselineY}`;
    return d;
  };

  const getMoonY = (h: number) => {
    const diff = (h - moonTransitHour + 24) % 24;
    const val = Math.cos((diff / 24.84) * 2 * Math.PI);
    return transitionBaselineY - val * (transitionAmplitude * 0.85);
  };

  const generateWavePath = (calc: (h: number) => number) => {
    let d = `M ${getX(0)} ${calc(0)}`;
    for (let h = 0.2; h <= 24; h += 0.2) {
      d += ` L ${getX(Math.min(h, 23.99))} ${calc(h)}`;
    }
    return d;
  };

  const sunPath = generateSunPath();
  const moonPath = generateWavePath(getMoonY);

  return (
    <div className="w-full mt-6 bg-slate-900/50 rounded-3xl p-4 border border-slate-800/50">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
          24H Activity & Solunar Pulse
        </h4>
        <div className="flex gap-4 text-[9px] font-bold">
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-400"></div> Activity</div>
          {isToday && <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-400"></div> Live</div>}
        </div>
      </div>

      <div className="relative w-full">
        <svg viewBox={`0 0 ${width} ${totalHeight}`} className="w-full h-auto overflow-visible" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Full-Height Vertical Grid Lines */}
          {Array.from({ length: 25 }).map((_, h) => (
            <line 
              key={`grid-${h}`}
              x1={getX(h)} 
              y1={padding} 
              x2={getX(h)} 
              y2={totalHeight - padding} 
              stroke="#1e293b" 
              strokeWidth="0.5" 
            />
          ))}

          {/* Activity Background Grid Horizontals */}
          {[0, 25, 50, 75, 100].map(v => (
            <g key={`h-${v}`}>
              <line 
                x1={padding} y1={getYActivity(v)} x2={width - padding} y2={getYActivity(v)} 
                stroke="#1e293b" strokeWidth="0.5" strokeDasharray="3,3" 
              />
              <text x={padding - 5} y={getYActivity(v) + 3} fontSize="6" textAnchor="end" fill="#475569" fontWeight="bold">{v}%</text>
            </g>
          ))}

          {/* Activity Curve Area */}
          <path d={areaPath} fill={curveFillColor} />
          <path
            d={linePath}
            fill="none"
            stroke={strokeColor}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-all duration-700"
          />

          {/* Centralized Hours Labels */}
          <rect x={padding} y={activityHeight - 5} width={width - 2*padding} height={labelSpace + 10} fill="#020617" fillOpacity="0.4" rx="8" />
          {[0, 6, 12, 18, 24].map(h => (
            <text 
              key={`time-${h}`}
              x={getX(h === 24 ? 23.99 : h)} 
              y={activityHeight + (labelSpace / 2) + 4} 
              fontSize="9" 
              textAnchor="middle" 
              fill="#94a3b8" 
              fontWeight="black"
            >
              {h === 24 ? '23:59' : `${h.toString().padStart(2, '0')}:00`}
            </text>
          ))}

          {/* Solar Rise/Set Vertical Markers */}
          {day.events.filter(e => e.type.includes('sun')).map((event, idx) => {
            const h = timeToHour(event.time);
            const x = getX(h);
            const solarColor = '#fbbf24';
            return (
              <g key={`sun-${idx}`}>
                <line x1={x} y1={padding} x2={x} y2={totalHeight - padding} stroke={solarColor} strokeWidth="1" strokeDasharray="2,2" />
                <circle cx={x} cy={padding} r="3" fill={solarColor} />
                <circle cx={x} cy={transitionBaselineY} r="2.5" fill={solarColor} />
                <text x={x} y={padding - 6} fontSize="7" textAnchor="middle" fill={solarColor} fontWeight="black">{event.label.toUpperCase()}</text>
              </g>
            );
          })}

          {/* Lunar Rise/Set Vertical Markers */}
          {day.events.filter(e => e.type.includes('moon')).map((event, idx) => {
            const h = timeToHour(event.time);
            const x = getX(h);
            const moonMarkerColor = '#94a3b8';
            return (
              <g key={`moon-${idx}`}>
                <line x1={x} y1={padding} x2={x} y2={totalHeight - padding} stroke={moonMarkerColor} strokeWidth="1" strokeDasharray="2,2" />
                <circle cx={x} cy={padding} r="3" fill={moonMarkerColor} />
                <circle cx={x} cy={transitionBaselineY} r="2.5" fill={moonMarkerColor} />
                <text x={x} y={padding - 14} fontSize="6" textAnchor="middle" fill={moonMarkerColor} fontWeight="black">{event.label.toUpperCase()}</text>
              </g>
            );
          })}

          {/* --- TRANSITION SUBCHART --- */}
          <line x1={padding} y1={transitionBaselineY} x2={width - padding} y2={transitionBaselineY} stroke="#334155" strokeWidth="2" />
          <text x={padding - 5} y={transitionBaselineY + 2.5} fontSize="6" textAnchor="end" fill="#94a3b8" fontWeight="black">0-AXIS</text>
          
          {/* Moon Orbit Pulse */}
          <path d={moonPath} fill="none" stroke="#64748b" strokeWidth="2" strokeDasharray="4,2" />
          <circle cx={getX(moonTransitHour)} cy={getMoonY(moonTransitHour)} r="4" fill="#64748b" />
          <text x={getX(moonTransitHour)} y={getMoonY(moonTransitHour) - 8} fontSize="7" textAnchor="middle" fill="#64748b" fontWeight="black">MOON</text>

          {/* Sun Transit Wave */}
          <path d={sunPath} fill="none" stroke="#f59e0b" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx={getX(solarNoon)} cy={getSunY(solarNoon)} r="5" fill="#f59e0b" className="shadow-xl shadow-amber-500/50" />
          <text x={getX(solarNoon)} y={getSunY(solarNoon) - 10} fontSize="8" textAnchor="middle" fill="#f59e0b" fontWeight="black">SUN</text>

          {/* Current Time Indicator (Live) */}
          {isToday && (
            <g>
              <line x1={getX(currentHour)} y1={padding} x2={getX(currentHour)} y2={totalHeight - padding} stroke="#34d399" strokeWidth="2" strokeDasharray="4,2" />
              <circle cx={getX(currentHour)} cy={totalHeight - padding} r="4" fill="#34d399" />
              <text x={getX(currentHour)} y={totalHeight - padding + 10} fontSize="8" textAnchor="middle" fill="#34d399" fontWeight="black">LIVE</text>
            </g>
          )}
        </svg>
      </div>
      
      {/* Legend Footer */}
      <div className="mt-8 pt-4 border-t border-slate-800/80 flex justify-between items-center">
        <div className="flex gap-5">
           <div className="flex items-center gap-2">
             <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]"></div>
             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">SOLAR TRANSIT</span>
           </div>
           <div className="flex items-center gap-2">
             <div className="w-2.5 h-2.5 rounded-full bg-slate-500"></div>
             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">LUNAR ORBIT</span>
           </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityChart;