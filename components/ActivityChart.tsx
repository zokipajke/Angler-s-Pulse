
import React from 'react';
import { FishingDay, SolarLunarEvent } from '../types';

interface ActivityChartProps {
  day: FishingDay;
}

const ActivityChart: React.FC<ActivityChartProps> = ({ day }) => {
  const data = day.hourlyActivity;
  const maxVal = 100;
  const width = 400;
  const height = 150;
  const padding = 20;

  // Map hours (0-23) to X coordinates
  const getX = (hour: number) => (hour / 23) * (width - 2 * padding) + padding;
  // Map values (0-100) to Y coordinates
  const getY = (val: number) => height - padding - (val / maxVal) * (height - 2 * padding);

  const points = data.map((v, i) => ({ x: getX(i), y: getY(v) }));

  // Smoothing function: Generates a cubic bezier path string
  const getCurvePath = (pts: { x: number, y: number }[]) => {
    if (pts.length < 2) return "";
    
    // Command for cubic bezier
    const bezierCommand = (point: { x: number, y: number }, i: number, a: { x: number, y: number }[]) => {
      // Control point calculation
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

    const d = pts.reduce((acc, point, i, a) => 
      i === 0 ? `M ${point.x},${point.y}` : `${acc} ${bezierCommand(point, i, a)}`
    , "");
    
    return d;
  };

  const linePath = getCurvePath(points);
  const areaPath = `${linePath} L ${getX(23)},${height - padding} L ${getX(0)},${height - padding} Z`;

  const isVibrant = day.score >= 70;
  const strokeColor = isVibrant ? '#22d3ee' : '#64748b';
  const curveFillColor = isVibrant ? 'url(#vibrantGradient)' : 'url(#darkGradient)';

  // Helper to convert "HH:mm" to fractional hour for plotting
  const timeToHour = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h + m / 60;
  };

  // Quality threshold bands
  const zones = [
    { label: 'EPIC', min: 75, max: 100, color: 'rgba(34, 211, 238, 0.05)' },
    { label: 'GOOD', min: 50, max: 75, color: 'rgba(52, 211, 153, 0.03)' },
    { label: 'FAIR', min: 30, max: 50, color: 'rgba(251, 191, 36, 0.02)' },
    { label: 'POOR', min: 0, max: 30, color: 'transparent' }
  ];

  return (
    <div className="w-full mt-6 bg-slate-900/50 rounded-3xl p-4 border border-slate-800/50">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
          24H Activity & Solunar Pulse
        </h4>
        <div className="flex gap-4 text-[9px] font-bold">
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-cyan-400"></div> Activity</div>
          <div className="flex items-center gap-1"><div className="w-0.5 h-2 bg-slate-600"></div> Pulse</div>
        </div>
      </div>

      <div className="relative h-[160px] w-full">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
          <defs>
            <linearGradient id="vibrantGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="darkGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#475569" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#475569" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Background Zones */}
          {zones.map((zone, i) => (
            <rect
              key={i}
              x={padding}
              y={getY(zone.max)}
              width={width - 2 * padding}
              height={getY(zone.min) - getY(zone.max)}
              fill={zone.color}
            />
          ))}

          {/* Grid Lines (Horizontal) */}
          {[0, 25, 50, 75, 100].map(v => (
            <g key={`h-${v}`}>
              <line 
                x1={padding} y1={getY(v)} x2={width - padding} y2={getY(v)} 
                stroke="#334155" strokeWidth="0.5" strokeDasharray="3,3" 
              />
              <text x={padding - 5} y={getY(v) + 3} fontSize="6" textAnchor="end" fill="#475569" fontWeight="bold">{v}%</text>
            </g>
          ))}

          {/* Grid Lines (Vertical) */}
          {[6, 12, 18].map(h => (
            <line 
              key={`v-${h}`}
              x1={getX(h)} y1={padding} x2={getX(h)} y2={height - padding} 
              stroke="#334155" strokeWidth="0.5" strokeDasharray="3,3" 
            />
          ))}

          {/* Smooth Area under the curve */}
          <path d={areaPath} fill={curveFillColor} />

          {/* Smooth activity line */}
          <path
            d={linePath}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-all duration-700"
          />

          {/* Event markers */}
          {day.events.map((event, idx) => {
            const h = timeToHour(event.time);
            const x = getX(h);
            const isSolar = event.type.includes('sun');
            return (
              <g key={idx}>
                <line x1={x} y1={padding} x2={x} y2={height - padding} stroke={isSolar ? '#fbbf24' : '#94a3b8'} strokeWidth="1" strokeDasharray="2,2" />
                <circle cx={x} cy={padding} r="2.5" fill={isSolar ? '#fbbf24' : '#94a3b8'} />
                <text x={x} y={padding - 6} fontSize="7" textAnchor="middle" fill={isSolar ? '#fbbf24' : '#94a3b8'} fontWeight="black">
                  {event.label.split(' ')[0]}
                </text>
              </g>
            );
          })}
        </svg>

        {/* X-Axis labels */}
        <div className="flex justify-between px-[20px] mt-2 text-[8px] font-black text-slate-600 uppercase tracking-tighter">
          <span>00:00</span>
          <span>06:00</span>
          <span>12:00</span>
          <span>18:00</span>
          <span>23:59</span>
        </div>
      </div>
    </div>
  );
};

export default ActivityChart;
