import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { subscribeEvent } from '../supabase/api';

const LandingPage = () => {
  const [event, setEvent] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const unsub = subscribeEvent(setEvent);
    return unsub;
  }, []);

  useEffect(() => {
    if (!event?.endDate) return;
    const tick = () => {
      const end = event.endDate?.toMillis
        ? event.endDate.toMillis()
        : new Date(event.endDate).getTime();
      if (isNaN(end)) return;

      const diff = end - Date.now();
      if (diff <= 0) { setTimeLeft('Event Ended'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${d}d ${h}h ${m}m ${s}s`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [event]);

  const stats = [
    { label: 'Companies', value: '30' },
    { label: 'Event Days', value: '7' },
    { label: 'Starting Capital', value: '🪙2L' },
    { label: 'Sectors', value: '11' },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-mudra-accent/10 via-transparent to-mudra-green/5" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.15),transparent_70%)]" />

        <div className="relative max-w-5xl mx-auto px-4 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 bg-mudra-accent/10 border border-mudra-accent/30 rounded-full px-4 py-1.5 text-sm text-mudra-accent mb-6">
            <span className="w-2 h-2 bg-mudra-green rounded-full animate-pulse" />
            Live Trading Event
          </div>

          {/* 3D Flipping Mudra Coin (Front & Back) */}
          <div className="flex justify-center mb-6">
            <div className="group perspective-1000 w-28 h-28 cursor-pointer">
              <div className="relative w-full h-full transition-transform duration-700 transform-style-preserve-3d group-hover:rotate-y-180 drop-shadow-[0_0_25px_rgba(245,158,11,0.35)]">
                {/* Front Face */}
                <div className="absolute inset-0 backface-hidden rounded-full border-2 border-mudra-gold/60 p-1 bg-mudra-card">
                  <img
                    src="/mudra-coin-front.png"
                    alt="Mudra Coin Front"
                    className="w-full h-full object-contain rounded-full"
                  />
                </div>
                {/* Back Face */}
                <div className="absolute inset-0 backface-hidden rounded-full border-2 border-mudra-gold/60 p-1 bg-mudra-card rotate-y-180">
                  <img
                    src="/mudra-coin-back.png"
                    alt="Mudra Coin Back"
                    className="w-full h-full object-contain rounded-full"
                  />
                </div>
              </div>
            </div>
          </div>

          <h1 className="text-6xl md:text-8xl font-black text-white mb-4 tracking-tight">
            MU<span className="text-mudra-accent">DRA</span>
          </h1>
          <p className="text-xl text-mudra-muted max-w-2xl mx-auto mb-8">
            India's most exciting student trading simulation. Invest virtual Mudra Coins,
            react to live market news, and climb the leaderboard over 7 intense days.
          </p>

          {/* Countdown */}
          {timeLeft && timeLeft !== 'Event Ended' && (
            <div className="card inline-flex flex-col items-center px-8 py-4 mb-8">
              <span className="text-mudra-muted text-xs uppercase tracking-widest mb-1">Event Ends In</span>
              <span className="text-3xl font-black font-mono text-mudra-gold">{timeLeft}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-3 justify-center">
            <Link to="/login" className="btn-primary px-8 py-3 text-base font-bold shadow-lg shadow-mudra-accent/25">
              Enter Trading Arena 🚀
            </Link>
            <Link to="/leaderboard" className="btn-outline px-8 py-3 text-base">
              View Leaderboard
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-5xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {stats.map(s => (
            <div key={s.label} className="card text-center">
              <div className="text-3xl font-black text-white font-mono">{s.value}</div>
              <div className="text-mudra-muted text-sm">{s.label}</div>
            </div>
          ))}
        </div>

        {/* How it works */}
        <h2 className="text-2xl font-bold text-white text-center mb-8">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: '🪙', title: 'Get 🪙2L Mudra Coins', desc: 'Every participant starts with 🪙2,00,000 virtual coins. No real money involved.' },
            { icon: '📈', title: 'Trade 30 Companies', desc: 'Buy and sell stocks across 11 sectors. Prices move based on your trades and live news.' },
            { icon: '🏆', title: 'Win the Event', desc: 'Top portfolio value on Day 7 wins. React to news faster than others to gain the edge.' },
          ].map(step => (
            <div key={step.title} className="card text-center">
              <div className="text-4xl mb-3">{step.icon}</div>
              <h3 className="font-bold text-white mb-2">{step.title}</h3>
              <p className="text-mudra-muted text-sm leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
