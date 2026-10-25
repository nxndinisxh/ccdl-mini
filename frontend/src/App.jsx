import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  AlertTriangle, 
  ShieldCheck, 
  Activity, 
  RefreshCw, 
  ArrowDownRight, 
  Layers, 
  DollarSign, 
  CheckCircle2, 
  Bell, 
  Cpu, 
  Database,
  BarChart3,
  Server
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceLine 
} from 'recharts';

const REGIME_CONFIG = {
  "Low-Volatility Bullish": {
    color: "#10b981",
    bgClass: "bg-emerald-950 text-emerald-400 border-emerald-800",
    badge: "LOW-VOL BULLISH",
    desc: "Persistent upward market trend accompanied by subdued volatility. Favorable macroeconomic environment for broad equity exposure."
  },
  "High-Volatility Bullish": {
    color: "#06b6d4",
    bgClass: "bg-cyan-950 text-cyan-400 border-cyan-800",
    badge: "HIGH-VOL BULLISH",
    desc: "Strong upward momentum but with elevated dispersion and volatility spikes. Caution advised against sudden pullbacks."
  },
  "Sideways / Neutral": {
    color: "#94a3b8",
    bgClass: "bg-slate-800 text-slate-300 border-slate-700",
    badge: "SIDEWAYS / CONSOLIDATION",
    desc: "Mean-reverting consolidation phase with lack of decisive directional trend. Balanced, range-trading approach suggested."
  },
  "High-Volatility Bearish": {
    color: "#f43f5e",
    bgClass: "bg-rose-950 text-rose-400 border-rose-800",
    badge: "HIGH-VOL BEARISH",
    desc: "Severe downward price pressure combined with elevated volatility and heightened tail risk. Capital preservation is priority."
  }
};

const RISK_TIERS = {
  LOW: "bg-emerald-900/80 text-emerald-300 border-emerald-700",
  MODERATE: "bg-amber-900/80 text-amber-300 border-amber-700",
  ELEVATED: "bg-orange-900/80 text-orange-300 border-orange-700",
  CRITICAL: "bg-rose-900/80 text-rose-300 border-rose-700 animate-pulse"
};

export default function App() {
  const [ticker, setTicker] = useState("^GSPC");
  const [loading, setLoading] = useState(false);
  const [shockLoading, setShockLoading] = useState(false);
  const [currentState, setCurrentState] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [clusterSummaries, setClusterSummaries] = useState([]);
  const [snsAlert, setSnsAlert] = useState(null);

  // Supported Tickers
  const tickers = [
    { symbol: "^GSPC", name: "S&P 500 Index" },
    { symbol: "^IXIC", name: "NASDAQ Composite" },
    { symbol: "GC=F", name: "Gold Futures" },
    { symbol: "TLT", name: "20+ Year Treasury Bond" },
    { symbol: "BTC-USD", name: "Bitcoin USD" },
  ];

  // Fetch current regime & risk assessment
  const fetchCurrentRegime = async (symbol) => {
    try {
      const res = await fetch(`/api/regime/current?ticker=${encodeURIComponent(symbol)}`);
      if (!res.ok) throw new Error("API call failed");
      const data = await res.json();
      setCurrentState(data);
      if (data.regime === "High-Volatility Bearish" || data.risk_score >= 75) {
        setSnsAlert({
          regime: data.regime,
          messageId: `sns-evt-${Math.floor(Math.random() * 90000 + 10000)}`
        });
      } else {
        setSnsAlert(null);
      }
    } catch (err) {
      console.error("Error fetching current state:", err);
    }
  };

  // Fetch historical timeline
  const fetchHistory = async (symbol) => {
    try {
      const res = await fetch(`/api/regime/history?ticker=${encodeURIComponent(symbol)}&limit=120`);
      if (!res.ok) throw new Error("API call failed");
      const data = await res.json();
      setHistoryData(data.history || []);
      setClusterSummaries(data.cluster_summaries || []);
    } catch (err) {
      console.error("Error fetching history:", err);
    }
  };

  // Refresh data
  const handleRefresh = async () => {
    setLoading(true);
    await Promise.all([fetchCurrentRegime(ticker), fetchHistory(ticker)]);
    setLoading(false);
  };

  // Simulate market crash stress test
  const handleShockSimulation = async () => {
    setShockLoading(true);
    try {
      const res = await fetch("/api/simulate-shock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, drop_pct: -5.5, volatility_mult: 2.8 }),
      });
      if (!res.ok) throw new Error("Simulation failed");
      const data = await res.json();

      setCurrentState(prev => ({
        ...prev,
        regime: data.resulting_regime,
        risk_score: data.risk_score,
        risk_tier: data.risk_tier,
        metrics: data.metrics,
        recommendation: data.adaptive_recommendation,
        current_price: prev ? prev.current_price * 0.945 : 5000,
      }));

      setSnsAlert({
        regime: data.resulting_regime,
        messageId: `sns-shock-${Math.floor(Math.random() * 90000 + 10000)}`
      });

      await fetchHistory(ticker);
    } catch (err) {
      console.error("Simulation error:", err);
    } finally {
      setShockLoading(false);
    }
  };

  useEffect(() => {
    handleRefresh();
  }, [ticker]);

  const activeRegime = currentState?.regime || "Low-Volatility Bullish";
  const regimeConfig = REGIME_CONFIG[activeRegime] || REGIME_CONFIG["Sideways / Neutral"];
  const metrics = currentState?.metrics || {};
  const rec = currentState?.recommendation || {};
  const weights = rec?.target_weights || { equities_pct: 80, fixed_income_pct: 15, cash_and_hedges_pct: 5 };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                Market Regime & Adaptive Risk Engine
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono">React 18 &bull; Vite</span>
              </h1>
              <p className="text-xs text-slate-400">Cloud Computing & DevOps Mini-Project &bull; School of Computer Engineering</p>
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

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6 flex-1 w-full">
        {/* Project Metadata & Students Info Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 text-xs text-slate-300">
          <div>
            <span className="text-slate-500 block font-semibold uppercase tracking-wider text-[10px]">Team Members</span>
            <span className="font-medium text-slate-200">Nandini Sah (Reg: 240905552)</span> &bull; 
            <span className="font-medium text-slate-200">Prisha Gupta (Reg: 240905612)</span>
            <div className="text-slate-400 text-[11px]">Semester 5 &bull; Section D &bull; Batch D2</div>
          </div>
          <div>
            <span className="text-slate-500 block font-semibold uppercase tracking-wider text-[10px]">Supervisors</span>
            <span className="font-medium text-slate-200">Dr. Anup Bhat &bull; Dr. Swati B P</span>
            <div className="text-slate-400 text-[11px]">School of Computer Engineering</div>
          </div>
          <div>
            <span className="text-slate-500 block font-semibold uppercase tracking-wider text-[10px]">DevOps & Cloud Stack</span>
            <div className="flex flex-wrap gap-1.5 mt-1 font-mono text-[10px]">
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">AWS Lambda</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">S3</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">SQS</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">SNS</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">DynamoDB</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">Terraform</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">Docker</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">GitHub Actions</span>
            </div>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-md">
          <div className="flex items-center gap-3">
            <label htmlFor="tickerSelect" className="text-xs font-semibold uppercase tracking-wider text-slate-400">Benchmark Asset:</label>
            <select 
              id="tickerSelect" 
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            >
              {tickers.map(t => (
                <option key={t.symbol} value={t.symbol}>{t.name} ({t.symbol})</option>
              ))}
            </select>
            <button 
              onClick={handleRefresh}
              disabled={loading}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 transition shadow-md shadow-indigo-600/30 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Ingest & Re-evaluate
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Live Demo Stress Test:</span>
            <button 
              onClick={handleShockSimulation}
              disabled={shockLoading}
              className="px-3 py-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-md shadow-rose-600/20 disabled:opacity-50"
              title="Simulate market crash to demonstrate instant regime change and adaptive risk protection"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {shockLoading ? 'Simulating Crash...' : 'Simulate Shock (-5% Stress Test)'}
            </button>
          </div>
        </div>

        {/* Current Regime & Risk Overview Banner */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Regime Card */}
          <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 to-slate-900/70 p-6 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Current Detected Market Regime</span>
                  <div className={`mt-2 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-lg font-bold border transition ${regimeConfig.bgClass}`}>
                    <Activity className="w-5 h-5" />
                    {activeRegime}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Latest Asset Price</span>
                  <div className="text-2xl font-bold font-mono text-white mt-1">
                    ${Number(currentState?.current_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed mb-4">
                {regimeConfig.desc}
              </p>
            </div>

            {/* SNS Alert Notification Simulator Banner */}
            {snsAlert && (
              <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center justify-between mt-3 animate-fade-in shadow-lg">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400 animate-ping"></span>
                  <div>
                    <strong className="font-semibold">Amazon SNS Real-Time Alert Dispatched:</strong> Regime transitioned into <em>{snsAlert.regime}</em>. Automated portfolio risk mitigation triggered!
                  </div>
                </div>
                <span className="font-mono text-[11px] opacity-75">{snsAlert.messageId}</span>
              </div>
            )}
          </div>

          {/* Risk Score Gauge Card */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-900/70 p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Portfolio Risk Score</span>
                <span className={`px-2.5 py-0.5 rounded text-xs font-bold border ${RISK_TIERS[currentState?.risk_tier] || RISK_TIERS.LOW}`}>
                  {currentState?.risk_tier || "LOW"}
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-4xl font-extrabold font-mono text-white">
                  {(currentState?.risk_score || 0).toFixed(1)}
                </span>
                <span className="text-slate-400 text-sm font-medium">/ 100</span>
              </div>
              
              {/* Progress bar gauge */}
              <div className="w-full bg-slate-800 h-3 rounded-full mt-3 overflow-hidden p-0.5">
                <div 
                  className="bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-600 h-full rounded-full transition-all duration-700" 
                  style={{ width: `${Math.min(100, Math.max(5, currentState?.risk_score || 0))}%` }}
                ></div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800/80 text-xs text-slate-400 flex justify-between">
              <span>Stance: <strong className="text-slate-200">{rec?.risk_stance || "Aggressive Growth"}</strong></span>
              <span>VaR (95%): <strong className="text-slate-200 font-mono">{metrics?.var_95_pct || 0}%</strong></span>
            </div>
          </div>
        </div>

        {/* Key Quantitative Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 block">VaR (95%)</span>
            <div className="text-lg font-bold font-mono text-slate-100 mt-1">{metrics?.var_95_pct || 0}%</div>
            <span className="text-[10px] text-slate-400">1-day 95% confidence</span>
          </div>

          <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 block">Tail VaR (99%)</span>
            <div className="text-lg font-bold font-mono text-slate-100 mt-1">{metrics?.var_99_pct || 0}%</div>
            <span className="text-[10px] text-slate-400">Extreme loss cutoff</span>
          </div>

          <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 block">Expected Shortfall</span>
            <div className="text-lg font-bold font-mono text-slate-100 mt-1">{metrics?.cvar_95_pct || 0}%</div>
            <span className="text-[10px] text-slate-400">CVaR tail conditional</span>
          </div>

          <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 block">Annualized Vol</span>
            <div className="text-lg font-bold font-mono text-slate-100 mt-1">{metrics?.annualized_volatility_pct || 0}%</div>
            <span className="text-[10px] text-slate-400">Rolling 21-day std</span>
          </div>

          <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 block">Max Drawdown</span>
            <div className="text-lg font-bold font-mono text-slate-100 mt-1">{metrics?.max_drawdown_pct || 0}%</div>
            <span className="text-[10px] text-slate-400">Peak-to-trough drop</span>
          </div>

          <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 block">Sharpe Ratio</span>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-1">{metrics?.sharpe_ratio || 0}</div>
            <span className="text-[10px] text-slate-400">Risk-adjusted return</span>
          </div>
        </div>

        {/* Adaptive Allocation & Cluster Centroids */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Adaptive Target Allocation */}
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Adaptive Asset Allocation Weights</h2>
              <span className="text-xs px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800 font-mono">Dynamic Rebalancing</span>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-cyan-400">Equities / Market Beta</span>
                  <span className="font-mono text-white">{weights?.equities_pct || 80}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-cyan-500 h-full rounded-full transition-all duration-500" style={{ width: `${weights?.equities_pct || 80}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-indigo-400">Fixed Income / US Treasuries</span>
                  <span className="font-mono text-white">{weights?.fixed_income_pct || 15}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-full rounded-full transition-all duration-500" style={{ width: `${weights?.fixed_income_pct || 15}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-amber-400">Cash Reserves & Defensive Hedges</span>
                  <span className="font-mono text-white">{weights?.cash_and_hedges_pct || 5}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${weights?.cash_and_hedges_pct || 5}%` }}></div>
                </div>
              </div>
            </div>

            <div className="mt-5 p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
              <span className="text-slate-400 font-semibold block uppercase tracking-wider text-[10px] mb-1">Action Directive:</span>
              <p className="text-slate-200 leading-relaxed">
                {rec?.action_directive || "Allocation optimized by adaptive risk engine."}
              </p>
            </div>
          </div>

          {/* K-Means Centroids Table */}
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-lg">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4">Unsupervised K-Means Cluster Centroids</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-2 font-medium">Regime Label</th>
                    <th className="pb-2 font-medium">Daily Ret %</th>
                    <th className="pb-2 font-medium">Ann. Vol %</th>
                    <th className="pb-2 font-medium">Trend Dev %</th>
                    <th className="pb-2 font-medium">RSI-14</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {clusterSummaries.map((c) => (
                    <tr key={c.cluster_id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 font-medium text-slate-200 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: REGIME_CONFIG[c.regime]?.color || "#94a3b8" }}></span>
                        {c.regime}
                      </td>
                      <td className="py-2.5 text-slate-300">{c.mean_daily_return_pct.toFixed(2)}%</td>
                      <td className="py-2.5 text-slate-300">{(c.mean_annualized_volatility * 100).toFixed(1)}%</td>
                      <td className="py-2.5 text-slate-300">{c.mean_trend_deviation_pct.toFixed(2)}%</td>
                      <td className="py-2.5 text-slate-300">{c.mean_rsi.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Historical Regime & Price Timeline Chart */}
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-lg">
          <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Historical Price & Detected Regimes Timeline</h2>
              <p className="text-xs text-slate-400">Interactive time-series of asset closing prices and unsupervised regime classification</p>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span> Low-Vol Bull</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span> High-Vol Bull</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span> Sideways</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> High-Vol Bear</span>
            </div>
          </div>

          <div className="w-full h-72 bg-slate-950 rounded-xl p-2 border border-slate-800/80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historyData}>
                <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis domain={['auto', 'auto']} stroke="#64748b" tick={{ fontSize: 10 }} tickFormatter={(val) => `$${val}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  labelStyle={{ color: '#94a3b8' }}
                  formatter={(value, name, props) => [
                    `$${Number(value).toFixed(2)}`, 
                    `Regime: ${props.payload.regime}`
                  ]}
                />
                <Line 
                  type="monotone" 
                  dataKey="close" 
                  stroke="#38bdf8" 
                  strokeWidth={2} 
                  dot={(props) => {
                    const color = REGIME_CONFIG[props.payload.regime]?.color || "#94a3b8";
                    return (
                      <circle 
                        cx={props.cx} 
                        cy={props.cy} 
                        r={2.5} 
                        fill={color} 
                        stroke="none"
                        key={`dot-${props.index}`} 
                      />
                    );
                  }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cloud-Native Architecture Blueprint */}
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-lg">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-2">Cloud-Native Event-Driven Architecture Blueprint</h2>
          <p className="text-xs text-slate-400 mb-6">Strictly compliant with the AWS Free Plan ($0.00 / month cost ceiling)</p>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-center text-xs">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
              <span className="font-mono text-[10px] text-cyan-400 uppercase tracking-widest font-bold">1. Ingestion</span>
              <div className="my-2">
                <strong className="text-white block">yfinance Fetcher</strong>
                <span className="text-slate-400 text-[11px]">OHLCV Data</span>
              </div>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/80 rounded py-0.5 border border-emerald-900">Always Free</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
              <span className="font-mono text-[10px] text-indigo-400 uppercase tracking-widest font-bold">2. Storage & Queue</span>
              <div className="my-2">
                <strong className="text-white block">Amazon S3 & SQS</strong>
                <span className="text-slate-400 text-[11px]">Decoupled Events</span>
              </div>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/80 rounded py-0.5 border border-emerald-900">1M Free Msgs/mo</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
              <span className="font-mono text-[10px] text-purple-400 uppercase tracking-widest font-bold">3. ML & Risk Worker</span>
              <div className="my-2">
                <strong className="text-white block">AWS Lambda</strong>
                <span className="text-slate-400 text-[11px]">K-Means & VaR</span>
              </div>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/80 rounded py-0.5 border border-emerald-900">1M Free Req/mo</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
              <span className="font-mono text-[10px] text-amber-400 uppercase tracking-widest font-bold">4. State & Alerting</span>
              <div className="my-2">
                <strong className="text-white block">DynamoDB & SNS</strong>
                <span className="text-slate-400 text-[11px]">NoSQL & Alerts</span>
              </div>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/80 rounded py-0.5 border border-emerald-900">25GB Free Storage</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
              <span className="font-mono text-[10px] text-rose-400 uppercase tracking-widest font-bold">5. DevOps & Alerts</span>
              <div className="my-2">
                <strong className="text-white block">Terraform & Actions</strong>
                <span className="text-slate-400 text-[11px]">Budget Alarm: $0.01</span>
              </div>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/80 rounded py-0.5 border border-emerald-900">Zero Incurred Fee</span>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        Cloud Computing & DevOps Mini-Project &bull; Department of Computer Science & Engineering &bull; 2026-27
      </footer>
    </div>
  );
}
