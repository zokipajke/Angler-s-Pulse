
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Location, MonthlyForecast, AppStatus, FishingDay } from './types';
import { calculateFishingForecast } from './services/solunarService';
import { 
  ChevronLeft, 
  ChevronRight, 
  MoonIcon, 
  FishIcon, 
  InfoIcon, 
  RefreshIcon,
  WindDirectionIcon,
  ThermometerIcon,
  PressureTrendIcon,
  CloudRainIcon,
  MoonPhaseVisual
} from './components/Icons';
import DayCell from './components/DayCell';
import ActivityChart from './components/ActivityChart';

const App: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [location, setLocation] = useState<Location | null>(null);
  const [forecast, setForecast] = useState<MonthlyForecast | null>(null);
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<FishingDay | null>(null);

  const getBrowserLocation = useCallback(() => {
    setStatus(AppStatus.LOADING);
    if (!navigator.geolocation) {
      setError("Geolocation is not supported. Defaulting to Novi Sad.");
      setLocation({ latitude: 45.2671, longitude: 19.8335 });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      },
      (err) => {
        setError("Location access denied. Defaulting to Novi Sad, Serbia.");
        setLocation({ latitude: 45.2671, longitude: 19.8335 });
      }
    );
  }, []);

  useEffect(() => {
    getBrowserLocation();
  }, [getBrowserLocation]);

  const loadForecast = useCallback(async () => {
    if (!location) return;

    try {
      setStatus(AppStatus.LOADING);
      // Artificial delay for feel
      await new Promise(r => setTimeout(r, 600));
      
      const data = await calculateFishingForecast(
        currentDate.getMonth() + 1,
        currentDate.getFullYear(),
        location
      );
      setForecast(data);
      setStatus(AppStatus.SUCCESS);
      
      const today = new Date();
      if (today.getMonth() === currentDate.getMonth() && today.getFullYear() === currentDate.getFullYear()) {
        const found = data.days.find(d => d.day === today.getDate());
        if (found) setSelectedDay(found);
      } else if (data.days.length > 0) {
        setSelectedDay(data.days[0]);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to calculate forecast.");
      setStatus(AppStatus.ERROR);
    }
  }, [currentDate, location]);

  useEffect(() => {
    if (location) {
      loadForecast();
    }
  }, [location, currentDate, loadForecast]);

  const changeMonth = (offset: number) => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1);
    setCurrentDate(newDate);
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
    const firstDay = getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth());
    const cells = [];

    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`empty-${i}`} className="w-full aspect-square" />);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dayData = forecast?.days.find(item => item.day === d);
      cells.push(
        <DayCell 
          key={d} 
          day={d} 
          data={dayData} 
          isSelected={selectedDay?.day === d}
          onClick={() => dayData && setSelectedDay(dayData)}
        />
      );
    }

    return cells;
  };

  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const year = currentDate.getFullYear();
  
  const scoreIntensity = selectedDay ? selectedDay.score : 0;

  const isSelectedDayToday = useMemo(() => {
    if (!selectedDay) return false;
    const now = new Date();
    return (
      selectedDay.day === now.getDate() &&
      currentDate.getMonth() === now.getMonth() &&
      currentDate.getFullYear() === now.getFullYear()
    );
  }, [selectedDay, currentDate]);

  return (
    <div className={`
      min-h-screen transition-colors duration-1000 overflow-x-hidden relative pb-12
      ${scoreIntensity >= 85 ? 'bg-violet-950/20' : scoreIntensity >= 60 ? 'bg-slate-900' : 'bg-black'}
    `}>
      <div className={`
        fixed inset-0 pointer-events-none transition-opacity duration-1000
        ${scoreIntensity >= 85 ? 'opacity-30' : scoreIntensity >= 70 ? 'opacity-20' : 'opacity-5'}
      `} style={{ 
        background: scoreIntensity >= 70 
          ? `radial-gradient(circle at 50% 10%, ${scoreIntensity >= 85 ? 'rgba(139, 92, 246, 0.4)' : 'rgba(52, 211, 153, 0.2)'}, transparent 80%)` 
          : '' 
      }} />

      <div className="max-w-md mx-auto flex flex-col px-4 relative z-10">
        <header className="py-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-cyan-400 to-emerald-400 tracking-tighter">
              ANGLER'S PULSE
            </h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-black flex items-center gap-1.5">
              <FishIcon className="w-3.5 h-3.5" /> Solunar Forecast
            </p>
          </div>
          <button 
            onClick={getBrowserLocation}
            className="w-11 h-11 flex items-center justify-center rounded-2xl bg-slate-900/80 border border-slate-700 text-slate-400 active:scale-90 transition-all shadow-lg backdrop-blur-sm"
          >
            <RefreshIcon />
          </button>
        </header>

        <div className="flex items-center justify-between mb-6 bg-slate-900/40 rounded-[2.5rem] p-1.5 border border-white/10 backdrop-blur-md shadow-2xl">
          <button onClick={() => changeMonth(-1)} className="w-12 h-12 flex items-center justify-center text-violet-400 active:scale-75 transition-transform">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="text-center">
            <h2 className="text-lg font-black text-slate-100 uppercase tracking-tight">{monthName}</h2>
            <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">{year}</p>
          </div>
          <button onClick={() => changeMonth(1)} className="w-12 h-12 flex items-center justify-center text-violet-400 active:scale-75 transition-transform">
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>

        {status === AppStatus.LOADING && (
          <div className="flex-1 flex flex-col items-center justify-center py-20 space-y-6">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-violet-400/5 border-t-violet-400 rounded-full animate-spin"></div>
              <FishIcon className="w-8 h-8 text-violet-400 absolute inset-0 m-auto animate-pulse" />
            </div>
            <div className="text-center">
              <p className="text-violet-400 font-black tracking-widest text-xs uppercase animate-pulse">Scanning Lunar Tides...</p>
            </div>
          </div>
        )}

        {status === AppStatus.ERROR && (
          <div className="bg-rose-950/20 border border-rose-500/20 p-8 rounded-[3rem] text-center backdrop-blur-sm">
            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <InfoIcon className="text-rose-400 w-8 h-8" />
            </div>
            <p className="text-rose-400 font-bold mb-6 text-sm uppercase tracking-tight">{error}</p>
            <button 
              onClick={loadForecast}
              className="w-full py-4 bg-rose-600 text-white rounded-full font-black text-xs uppercase shadow-xl active:scale-95 transition-transform"
            >
              Retry
            </button>
          </div>
        )}

        {status === AppStatus.SUCCESS && (
          <>
            <div className="grid grid-cols-7 gap-1.5 mb-2 bg-slate-900/30 p-4 rounded-[2.5rem] border border-white/5 backdrop-blur-sm shadow-xl">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
                <div key={d} className="text-center text-[10px] font-black text-slate-600 pb-2 uppercase">{d}</div>
              ))}
              {renderCalendar()}
            </div>

            <div className="flex justify-center gap-4 py-4 mb-6">
              <LegendItem color="bg-violet-500" label="Epic" shadow="shadow-violet-500/50" />
              <LegendItem color="bg-emerald-400" label="Good" shadow="shadow-emerald-400/50" />
              <LegendItem color="bg-amber-400" label="Fair" shadow="shadow-amber-400/50" />
              <LegendItem color="bg-slate-700" label="Poor" />
            </div>

            {selectedDay && (
              <div className={`
                rounded-[3.5rem] p-8 transition-all duration-700 border shadow-2xl overflow-hidden relative
                ${selectedDay.score >= 85 
                  ? 'bg-violet-900/40 border-violet-400/60 shadow-violet-900/50' 
                  : selectedDay.score >= 70
                  ? 'bg-emerald-900/30 border-emerald-500/40 shadow-emerald-900/30'
                  : selectedDay.score >= 40
                  ? 'bg-slate-900/80 border-slate-700 shadow-black/80'
                  : 'bg-black/90 border-slate-800 shadow-black'}
              `}>
                <div className="absolute top-6 left-8 pointer-events-none">
                   <span className="text-[7px] font-black text-slate-400 uppercase tracking-[0.3em] bg-white/5 px-3 py-1 rounded-full border border-white/10">LOCAL CALCULATION</span>
                </div>

                {/* THE REFINED HEADER LAYOUT ALIGNED BY CENTERLINE */}
                <div className="flex justify-between items-start mb-10 mt-6 px-2">
                  {/* DATE BLOCK - Day number is centered in its own 24-unit container to match moon icon's vertical center */}
                  <div className="w-1/4 flex flex-col items-center">
                    <div className="h-24 flex items-center justify-center">
                      <h3 className="text-6xl font-black leading-none tracking-tighter">
                        {selectedDay.day}
                      </h3>
                    </div>
                    <p className="text-lg text-slate-400 font-bold uppercase tracking-tight -mt-4">
                      {monthName.slice(0, 3)}
                    </p>
                  </div>

                  {/* VISUAL MOON BLOCK - Primary Center Reference */}
                  <div className="flex-1 flex flex-col items-center">
                    <div className="h-24 flex items-center justify-center">
                      <MoonPhaseVisual phase={selectedDay.moonPhaseValue} className="w-24 h-24" />
                    </div>
                    <div className="bg-slate-100/10 border border-white/10 px-4 py-1.5 rounded-full backdrop-blur-sm mt-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-100 whitespace-nowrap">
                        {selectedDay.moonPhase}
                      </span>
                    </div>
                  </div>

                  {/* SUCCESS RATE BLOCK - Aligned by circle center with Epic conditions badge directly above */}
                  <div className="w-1/4 flex flex-col items-center relative">
                    <div className="absolute -top-6 flex justify-center w-full">
                      {selectedDay.score >= 85 && (
                        <div className="bg-gradient-to-r from-violet-400 to-fuchsia-500 text-white text-[8px] font-black px-4 py-1.5 rounded-full animate-bounce shadow-lg shadow-violet-500/50 uppercase tracking-widest whitespace-nowrap">
                          EPIC CONDITIONS
                        </div>
                      )}
                    </div>
                    <div className="h-24 flex items-center justify-center">
                      <div className={`
                        w-24 h-24 rounded-[2.5rem] flex items-center justify-center flex-col border-2 transition-all duration-700
                        ${selectedDay.score >= 85 
                          ? 'bg-violet-400/20 border-violet-400 text-violet-400 shadow-[0_0_40px_rgba(139,92,246,0.6)]' 
                          : selectedDay.score >= 70
                          ? 'bg-emerald-400/20 border-emerald-400 text-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.3)]'
                          : 'bg-slate-800/40 border-slate-600 text-slate-300'}
                      `}>
                        <span className="text-3xl font-black leading-none">{selectedDay.score}%</span>
                        <span className="text-[8px] font-black uppercase opacity-70 mt-1 tracking-tighter text-center leading-none px-2">SUCCESS<br/>RATE</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-black/40 rounded-[2.5rem] p-6 border border-white/5 backdrop-blur-sm">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 flex justify-between items-center">
                      <span>WEATHER DATA</span>
                      <div className="flex items-center gap-2 text-right">
                        <CloudRainIcon className="w-4 h-4 text-blue-400" />
                        <span className="text-[10px] font-black text-slate-100 uppercase tracking-tight">
                          {selectedDay.weather.conditions}
                        </span>
                      </div>
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-800/60 flex items-center justify-center text-rose-400 border border-white/5 shadow-inner">
                          <ThermometerIcon className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">Temp</p>
                          <p className="text-base font-black text-slate-100">{selectedDay.weather.tempLow}° - {selectedDay.weather.tempHigh}°C</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-800/60 flex items-center justify-center text-cyan-400 border border-white/5 shadow-inner">
                          <PressureTrendIcon trend={selectedDay.weather.pressureTrend} className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">Pressure</p>
                          <p className="text-base font-black text-slate-100">{selectedDay.weather.pressure} mb</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-800/60 flex items-center justify-center text-emerald-400 border border-white/5 shadow-inner">
                          <WindDirectionIcon direction={selectedDay.weather.windDirection} className="w-10 h-10" />
                        </div>
                        <div>
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">Wind</p>
                          <p className="text-base font-black text-slate-100">{selectedDay.weather.windSpeed} km/h</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-800/60 flex items-center justify-center text-slate-500 border border-white/5 shadow-inner">
                          <InfoIcon className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">Trend</p>
                          <p className="text-[10px] font-black text-slate-400 leading-tight uppercase tracking-widest">
                            {selectedDay.weather.pressureTrend === 'falling' ? 'Active Bite' : 'Stable Bait'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <ActivityChart day={selectedDay} isToday={isSelectedDayToday} />

                  <div className="grid grid-cols-2 gap-4">
                    {selectedDay.bestTimes.map((time, idx) => (
                      <div key={idx} className={`
                        rounded-[2.5rem] p-6 border text-center transition-all duration-700
                        ${selectedDay.score >= 85 ? 'bg-violet-500/10 border-violet-500/30 shadow-lg' : selectedDay.score >= 70 ? 'bg-emerald-500/10 border-emerald-500/30 shadow-lg' : 'bg-slate-800/60 border-slate-700'}
                      `}>
                        <h4 className="text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">
                          {idx === 0 ? 'Major Peak' : 'Minor Peak'}
                        </h4>
                        <p className={`font-black text-xl ${selectedDay.score >= 85 ? 'text-violet-400' : selectedDay.score >= 70 ? 'text-emerald-400' : 'text-slate-100'}`}>{time}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const LegendItem = ({ color, label, shadow = "" }: { color: string, label: string, shadow?: string }) => (
  <div className="flex items-center gap-1.5 flex-shrink-0">
    <div className={`w-2 h-2 rounded-full ${color} ${shadow} shadow-[0_0_8px]`}></div>
    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
  </div>
);

export default App;
