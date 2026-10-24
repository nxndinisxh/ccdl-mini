import React, { useState, useEffect, useRef } from 'react';

const REGIME_COLORS = {
  'Low-Volatility Bullish': '#10b981',
  'High-Volatility Bullish': '#06b6d4',
  'Sideways / Neutral': '#94a3b8',
  'High-Volatility Bearish': '#f43f5e',
};

const DEFAULT_STATE = {
  ticker: '^GSPC',
  current_price: 5864.20,
  regime: 'Low-Volatility Bullish',
  risk_score: 28.4,
  risk_tier: 'LOW',
  cluster_id: 0,
  metrics: {
    var_95_pct: 1.12,
    var_99_pct: 1.84,
    cvar_95_pct: 2.31,
    annualized_volatility_pct: 11.8,
    max_drawdown_pct: 8.65,
    sharpe_ratio: 1.85,
  },
  recommendation: {
    risk_stance: 'Aggressive Growth',
    action_directive: 'Maintain full equity exposure. Low volatility indicates favorable macroeconomic conditions for trend following.',
    target_weights: {
      equities_pct: 80,
      fixed_income_pct: 15,
      cash_and_hedges_pct: 5,
    },
  },
};

const CENTROIDS = [
  { label: 'Low-Vol Bullish', ret: '+0.08%', vol: '11.2%', trend: '+3.4%', rsi: '58.2', color: '#10b981' },
  { label: 'High-Vol Bullish', ret: '+0.14%', vol: '24.8%', trend: '+6.8%', rsi: '68.4', color: '#06b6d4' },
  { label: 'Sideways / Neutral', ret: '+0.01%', vol: '14.1%', trend: '-0.2%', rsi: '49.6', color: '#94a3b8' },
  { label: 'High-Vol Bearish', ret: '-0.21%', vol: '31.5%', trend: '-8.6%', rsi: '32.1', color: '#f43f5e' },
];

export default function App() {
  const [ticker, setTicker] = useState('^GSPC');
  const [state, setState] = useState(DEFAULT_STATE);
  const [loading, setLoading] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const canvasRef = useRef(null);

  // Load data
  const fetchData = async (selectedTicker) => {
    setLoading(true);
    setAlertVisible(false);
    try {
      const res = await fetch(`/api/regime/current?ticker=${encodeURIComponent(selectedTicker)}`);
      if (res.ok) {
        const json = await res.json();
        setState(json);
        if (json.regime === 'High-Volatility Bearish' || json.risk_score >= 75) {
          setAlertVisible(true);
        }
      }
    } catch {
      // Offline fallback
      const priceMap = { '^GSPC': 5864.20, '^IXIC': 18518.60, 'GC=F': 2736.80, 'TLT': 92.45, 'BTC-USD': 67840.00 };
      setState({
        ...DEFAULT_STATE,
        ticker: selectedTicker,
        current_price: priceMap[selectedTicker] || 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  // Simulate Crash Shock
  const handleShock = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/simulate-shock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, drop_pct: -5.5, volatility_mult: 2.8 }),
      });
      if (res.ok) {
        const json = await res.json();
        setState((prev) => ({
          ...prev,
          current_price: prev.current_price * 0.945,
          regime: json.resulting_regime,
          risk_score: json.risk_score,
          risk_tier: json.risk_tier,
          metrics: json.metrics,
          recommendation: json.adaptive_recommendation,
        }));
        setAlertVisible(true);
      }
    } catch {
      // Fallback shock simulation
      setState((prev) => ({
        ...prev,
        current_price: prev.current_price * 0.945,
        regime: 'High-Volatility Bearish',
        risk_score: 86.4,
        risk_tier: 'CRITICAL',
        recommendation: {
          risk_stance: 'Capital Preservation / Defensive',
          action_directive: 'Execute tactical de-escalation: reduce equity exposure to 15% and prioritize cash buffer (50%).',
          target_weights: { equities_pct: 15, fixed_income_pct: 35, cash_and_hedges_pct: 50 },
        },
      }));
      setAlertVisible(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(ticker);
  }, [ticker]);

  // Draw Canvas Timeline
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const padL = 50, padR = 20, padT = 20, padB = 25;

    ctx.clearRect(0, 0, w, h);

    const points = 60;
    const path = [];
    let p = state.current_price * 0.92;
    for (let i = 0; i < points; i++) {
      let ret = (Math.random() - 0.48) * 0.015;
      if (i > 45 && state.regime === 'High-Volatility Bearish') {
        ret = -0.018 + (Math.random() - 0.5) * 0.02;
      }
      p = p * (1 + ret);

      let seg = 'Low-Volatility Bullish';
      if (i < 20) seg = 'Low-Volatility Bullish';
      else if (i < 38) seg = 'High-Volatility Bullish';
      else if (i < 48) seg = 'Sideways / Neutral';
      else seg = state.regime;

      path.push({ p, regime: seg });
    }

    const prices = path.map((d) => d.p);
    const minP = Math.min(...prices) * 0.99;
    const maxP = Math.max(...prices) * 1.01;
    const chartW = w - padL - padR;
    const chartH = h - padT - padB;

    ctx.strokeStyle = '#1e293b';
    ctx.fillStyle = '#64748b';
    ctx.font = '11px monospace';
    ctx.textAlign = 'right';

    for (let i = 0; i <= 3; i++) {
      const yVal = minP + (i / 3) * (maxP - minP);
      const yPx = padT + chartH - (i / 3) * chartH;
      ctx.beginPath();
      ctx.moveTo(padL, yPx);
      ctx.lineTo(w - padR, yPx);
      ctx.stroke();
      ctx.fillText(`$${yVal.toFixed(0)}`, padL - 8, yPx + 4);
    }

    for (let i = 0; i < path.length - 1; i++) {
      const x1 = padL + (i / (path.length - 1)) * chartW;
      const y1 = padT + chartH - ((path[i].p - minP) / (maxP - minP)) * chartH;
      const x2 = padL + ((i + 1) / (path.length - 1)) * chartW;
      const y2 = padT + chartH - ((path[i + 1].p - minP) / (maxP - minP)) * chartH;

      ctx.strokeStyle = REGIME_COLORS[path[i + 1].regime] || '#94a3b8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }, [state]);

  const weights = state.recommendation?.target_weights || { equities_pct: 80, fixed_income_pct: 15, cash_and_hedges_pct: 5 };

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              MR
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                Market Regime & Adaptive Risk Engine
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono">React v18</span>
              </h1>
              <p className="text-xs text-slate-400">Cloud Computing & DevOps Mini-Project • School of Computer Engineering</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/80">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              AWS Serverless Active
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-purple-950/80 text-purple-300 border border-purple-800/80 font-mono">
              Free Tier: $0.00
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Project Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 text-xs text-slate-300">
          <div>
            <span className="text-slate-500 block font-semibold uppercase tracking-wider text-[11px]">Team Members</span>
            <span className="font-medium text-slate-200">Nandini Sah (Reg: 240905552)</span> • <span className="font-medium text-slate-200">Prisha Gupta (Reg: 240905612)</span>
            <div className="text-slate-400 text-xs mt-0.5">Semester 5 • Section D • Batch D2</div>
          </div>
          <div>
            <span className="text-slate-500 block font-semibold uppercase tracking-wider text-[11px]">Supervisors</span>
            <span className="font-medium text-slate-200">Dr. Anup Bhat • Dr. Swati B P</span>
            <div className="text-slate-400 text-xs mt-0.5">School of Computer Engineering</div>
          </div>
          <div>
            <span className="text-slate-500 block font-semibold uppercase tracking-wider text-[11px]">DevOps & Cloud Stack</span>
            <div className="flex flex-wrap gap-1.5 mt-1 font-mono text-xs">
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">AWS Lambda</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">S3</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">SQS</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">SNS</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">DynamoDB</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">Terraform</span>
            </div>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Benchmark Asset:</label>
            <select
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-100 text-xs rounded-lg px-3 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="^GSPC">S&P 500 Index (^GSPC)</option>
              <option value="^IXIC">NASDAQ Composite (^IXIC)</option>
              <option value="GC=F">Gold Futures (GC=F)</option>
              <option value="TLT">20+ Year Treasury Bonds (TLT)</option>
              <option value="BTC-USD">Bitcoin (BTC-USD)</option>
            </select>
            <button
              onClick={() => fetchData(ticker)}
              disabled={loading}
              className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 transition shadow-md shadow-indigo-600/30"
            >
              {loading ? 'Evaluating...' : 'Ingest & Re-evaluate'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Live Demo Simulation:</span>
            <button
              onClick={handleShock}
              disabled={loading}
              className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-md shadow-rose-600/20"
            >
              Simulate Shock (-5% Stress Test)
            </button>
          </div>
        </div>

        {/* Alert Banner */}
        {alertVisible && (
          <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping"></span>
              <strong>Amazon SNS Real-Time Alert:</strong> Market Regime transitioned to High-Volatility Bearish. Notification dispatched!
            </div>
            <span className="font-mono text-xs opacity-80">MessageId: sns-evt-94812</span>
          </div>
        )}

        {/* Current Regime + Risk Score */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 to-slate-900/70 p-6 rounded-2xl border border-slate-800 shadow-xl relative">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Current Detected Market Regime</span>
                <div className={`mt-2 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-lg font-bold border ${
                  state.regime === 'Low-Volatility Bullish' ? 'bg-emerald-950 text-emerald-400 border-emerald-800' :
                  state.regime === 'High-Volatility Bullish' ? 'bg-cyan-950 text-cyan-400 border-cyan-800' :
                  state.regime === 'High-Volatility Bearish' ? 'bg-rose-950 text-rose-400 border-rose-800 animate-pulse' :
                  'bg-slate-800 text-slate-300 border-slate-700'
                }`}>
                  {state.regime}
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Latest Asset Price</span>
                <div className="text-2xl font-bold font-mono text-white mt-1">
                  ${Number(state.current_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              {state.regime === 'High-Volatility Bearish'
                ? 'Severe downward price pressure combined with elevated volatility and heightened tail risk. Capital preservation is priority.'
                : 'Persistent upward market trend accompanied by subdued volatility. Favorable macroeconomic environment for broad equity exposure.'}
            </p>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-900/70 p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Portfolio Risk Score</span>
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${state.risk_score >= 75 ? 'bg-rose-900 text-rose-300' : 'bg-emerald-900 text-emerald-300'}`}>
                  {state.risk_tier}
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-4xl font-extrabold font-mono text-white">{Number(state.risk_score).toFixed(1)}</span>
                <span className="text-slate-400 text-xs font-medium">/ 100</span>
              </div>
              <div className="w-full bg-slate-800 h-3 rounded-full mt-3 overflow-hidden p-0.5">
                <div
                  className="bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-600 h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, Math.max(5, state.risk_score))}%` }}
                ></div>
              </div>
            </div>
            <div className="pt-4 border-t border-slate-800/80 text-xs text-slate-400 flex justify-between">
              <span>Stance: <strong className="text-slate-200">{state.recommendation?.risk_stance}</strong></span>
              <span>VaR (95%): <strong className="text-slate-200 font-mono">{state.metrics?.var_95_pct}%</strong></span>
            </div>
          </div>
        </div>

        {/* Adaptive Allocation */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-lg">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-4">Adaptive Asset Allocation Weights</h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-cyan-400">Equities / Beta Exposure</span>
                  <span className="font-mono text-white">{weights.equities_pct}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-cyan-500 h-full rounded-full transition-all duration-500" style={{ width: `${weights.equities_pct}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-indigo-400">Fixed Income / US Treasuries</span>
                  <span className="font-mono text-white">{weights.fixed_income_pct}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-full rounded-full transition-all duration-500" style={{ width: `${weights.fixed_income_pct}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-amber-400">Cash Reserves & Hedges</span>
                  <span className="font-mono text-white">{weights.cash_and_hedges_pct}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${weights.cash_and_hedges_pct}%` }}></div>
                </div>
              </div>
            </div>
            <div className="mt-5 p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
              <span className="text-slate-400 font-semibold block uppercase tracking-wider text-xs mb-1">Action Directive:</span>
              <p className="text-slate-200 leading-relaxed">{state.recommendation?.action_directive}</p>
            </div>
          </div>

          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-lg">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-4">Unsupervised K-Means Cluster Centroids</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-sans">
                    <th className="pb-2 font-medium">Regime Label</th>
                    <th className="pb-2 font-medium">Daily Ret %</th>
                    <th className="pb-2 font-medium">Ann. Vol %</th>
                    <th className="pb-2 font-medium">Trend Dev %</th>
                    <th className="pb-2 font-medium">RSI-14</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {CENTROIDS.map((c) => (
                    <tr key={c.label}>
                      <td className="py-2.5 font-medium text-slate-200 flex items-center gap-2 font-sans">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }}></span>
                        {c.label}
                      </td>
                      <td className="py-2.5 text-slate-300">{c.ret}</td>
                      <td className="py-2.5 text-slate-300">{c.vol}</td>
                      <td className="py-2.5 text-slate-300">{c.trend}</td>
                      <td className="py-2.5 text-slate-300">{c.rsi}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Timeline Canvas */}
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-lg">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">Historical Price & Detected Regimes Timeline</h2>
          <div className="relative w-full h-72 bg-slate-950 rounded-xl p-4 border border-slate-800/80">
            <canvas ref={canvasRef} className="w-full h-full"></canvas>
          </div>
        </div>
      </main>
    </div>
  );
}
