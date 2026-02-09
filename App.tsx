
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
  CloudRainIcon
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
      setError("Geolocation is not supported by your browser. Defaulting to Novi Sad.");
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
      await new Promise(r => setTimeout(r, 800));
      
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
      setError("Failed to calculate forecast locally.");
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
              <FishIcon className="w-3.5 h-3.5" /> Solunar Fishing Forecast
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
              <p className="text-violet-400 font-black tracking-widest text-xs uppercase animate-pulse">Calculating Tides & Stars...</p>
              <p className="text-slate-500 text-[10px] mt-1 font-medium uppercase">Processing Offline Forecast...</p>
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
                rounded-[3rem] p-8 transition-all duration-700 border shadow-2xl overflow-hidden relative
                ${selectedDay.score >= 85 
                  ? 'bg-violet-900/30 border-violet-400/50 shadow-violet-900/40' 
                  : selectedDay.score >= 70
                  ? 'bg-emerald-900/20 border-emerald-500/30 shadow-emerald-900/20'
                  : selectedDay.score >= 40
                  ? 'bg-slate-900/60 border-slate-700 shadow-black/80'
                  : 'bg-black/80 border-slate-800 shadow-black'}
              `}>
                <div className="absolute top-4 left-4">
                   <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest bg-white/5 px-2 py-1 rounded">Local Calculation</span>
                </div>

                {selectedDay.score >= 85 && (
                  <div className="absolute top-0 right-0 p-4">
                    <div className="bg-gradient-to-r from-violet-400 to-fuchsia-500 text-white text-[9px] font-black px-4 py-1.5 rounded-full animate-bounce shadow-lg shadow-violet-500/50 uppercase tracking-widest">
                      EPIC CONDITIONS
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-start mb-8 mt-4">
                  <div>
                    <h3 className="text-5xl font-black mb-1.5 flex items-baseline gap-2">
                      {selectedDay.day}
                      <span className="text-xl text-slate-500 font-bold uppercase tracking-tighter">
                        {monthName.slice(0, 3)}
                      </span>
                    </h3>
                    <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${selectedDay.score >= 85 ? 'text-violet-400' : selectedDay.score >= 70 ? 'text-emerald-400' : 'text-slate-500'}`}>
                      <MoonIcon className="w-4 h-4" />
                      {selectedDay.moonPhase}
                    </div>
                  </div>
                  <div className={`
                    w-24 h-24 rounded-[2.5rem] flex items-center justify-center flex-col border-2 transition-all duration-700
                    ${selectedDay.score >= 85 
                      ? 'bg-violet-400/10 border-violet-400 text-violet-400 shadow-[0_0_30px_rgba(139,92,246,0.4)]' 
                      : selectedDay.score >= 70
                      ? 'bg-emerald-400/10 border-emerald-400 text-emerald-400'
                      : 'bg-slate-800/20 border-slate-700 text-slate-400'}
                  `}>
                    <span className="text-3xl font-black leading-none">{selectedDay.score}%</span>
                    <span className="text-[9px] font-black uppercase opacity-60 mt-1 tracking-tighter">Success Rate</span>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-black/30 rounded-[2.5rem] p-6 border border-white/5 backdrop-blur-sm">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex justify-between items-center gap-4">
                      <span>OFFLINE PULSE</span>
                      <div className="flex items-center gap-1.5 text-right flex-1 justify-end">
                        <CloudRainIcon className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-[9px] font-bold text-slate-100 uppercase tracking-tight">
                          {selectedDay.weather.conditions}
                        </span>
                      </div>
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-800/40 flex items-center justify-center text-rose-400 border border-white/5">
                          <ThermometerIcon />
                        </div>
                        <div>
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">Temp</p>
                          <p className="text-sm font-black text-slate-100">{selectedDay.weather.tempLow}° - {selectedDay.weather.tempHigh}°C</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-800/40 flex items-center justify-center text-cyan-400 border border-white/5">
                          <PressureTrendIcon trend={selectedDay.weather.pressureTrend} />
                        </div>
                        <div>
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">Pressure</p>
                          <p className="text-sm font-black text-slate-100">{selectedDay.weather.pressure} mb</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-800/40 flex items-center justify-center text-emerald-400 border border-white/5">
                          <WindDirectionIcon direction={selectedDay.weather.windDirection} />
                        </div>
                        <div>
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">Wind</p>
                          <p className="text-sm font-black text-slate-100">{selectedDay.weather.windSpeed} km/h</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-800/40 flex items-center justify-center text-slate-500 border border-white/5">
                          <InfoIcon />
                        </div>
                        <div className="flex-1">
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">Trend</p>
                          <p className="text-[9px] font-bold text-slate-500 leading-tight uppercase tracking-tighter">
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
                        rounded-[2rem] p-5 border text-center transition-all duration-700
                        ${selectedDay.score >= 85 ? 'bg-violet-500/5 border-violet-500/20 shadow-lg shadow-violet-900/10' : selectedDay.score >= 70 ? 'bg-emerald-500/5 border-emerald-500/20 shadow-lg shadow-emerald-900/10' : 'bg-slate-800/40 border-slate-800'}
                      `}>
                        <h4 className="text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">
                          {idx === 0 ? 'Major Peak' : 'Minor Peak'}
                        </h4>
                        <p className={`font-black text-lg ${selectedDay.score >= 85 ? 'text-violet-400' : selectedDay.score >= 70 ? 'text-emerald-400' : 'text-slate-100'}`}>{time}</p>
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
