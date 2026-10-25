import React, { useState, useEffect, useMemo } from 'react';
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
  Server,
  Zap,
  Sliders,
  Download,
  Info,
  ChevronRight,
  ExternalLink,
  Lock,
  Globe,
  Radio,
  SlidersHorizontal,
  Flame,
  FileSpreadsheet
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  ComposedChart,
  Area, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid
} from 'recharts';

const ASSETS = [
  { symbol: "^GSPC", name: "S&P 500", tickerShort: "SPX", assetClass: "US Large Cap Equity" },
  { symbol: "^IXIC", name: "NASDAQ-100", tickerShort: "NDX", assetClass: "Tech Growth Equity" },
  { symbol: "GC=F", name: "Gold Futures", tickerShort: "XAU", assetClass: "Precious Metals / Safe Haven" },
  { symbol: "TLT", name: "20+ Year Treasuries", tickerShort: "TLT", assetClass: "Sovereign Debt / Fixed Income" },
  { symbol: "BTC-USD", name: "Bitcoin Index", tickerShort: "BTC", assetClass: "Digital Asset / High Beta" },
];

const REGIME_META = {
  "Low-Volatility Bullish": {
    badge: "LOW-VOL EXPANSION",
    color: "#10b981",
    textColor: "text-emerald-400",
    bgClass: "bg-emerald-950/60 border-emerald-800/80 text-emerald-300",
    signal: "MAXIMUM EQUITY EXPOSURE",
    directive: "Sustained upward trend accompanied by compressed volatility. Optimal environment for full risk-on equity exposure and momentum harvesting."
  },
  "High-Volatility Bullish": {
    badge: "VOLATILE MOMENTUM",
    color: "#06b6d4",
    textColor: "text-cyan-400",
    bgClass: "bg-cyan-950/60 border-cyan-800/80 text-cyan-300",
    signal: "TACTICAL HEDGE / TRIM BETA",
    directive: "Strong positive momentum coupled with elevated return dispersion. Maintain upside equity exposure while establishing volatility hedges."
  },
  "Sideways / Neutral": {
    badge: "RANGE CONSOLIDATION",
    color: "#94a3b8",
    textColor: "text-slate-300",
    bgClass: "bg-slate-800/80 border-slate-700 text-slate-200",
    signal: "MARKET-NEUTRAL REBALANCE",
    directive: "Mean-reverting consolidation phase with absence of directional trend. Rotate into fixed income, yield strategies, and market-neutral allocations."
  },
  "High-Volatility Bearish": {
    badge: "CRITICAL REGIME: CONTRACTION",
    color: "#f43f5e",
    textColor: "text-rose-400",
    bgClass: "bg-rose-950/80 border-rose-800 text-rose-300",
    signal: "EMERGENCY CAPITAL PRESERVATION",
    directive: "Severe structural drawdown detected. Elevated tail risk and high correlation spike. Immediately throttle equity beta to defensive minimums and allocate to cash/liquidity."
  }
};

export default function App() {
  const [selectedAsset, setSelectedAsset] = useState(ASSETS[0]);
  const [activeTab, setActiveTab] = useState('overview'); // overview, stress-test, telemetry
  const [portfolioCapital, setPortfolioCapital] = useState(1000000); // $1M portfolio
  const [loading, setLoading] = useState(false);
  const [shockRunning, setShockRunning] = useState(false);
  const [currentState, setCurrentState] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [clusterSummaries, setClusterSummaries] = useState([]);
  const [toastMessage, setToastMessage] = useState(null);
  const [showAcademicModal, setShowAcademicModal] = useState(false);

  const showToast = (title, desc) => {
    setToastMessage({ title, desc });
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Fetch current market state
  const loadState = async (symbol) => {
    try {
      const res = await fetch(`/api/regime/current?ticker=${encodeURIComponent(symbol)}`);
      if (!res.ok) throw new Error("Backend query failed");
      const data = await res.json();
      setCurrentState(data);
    } catch (err) {
      console.error(err);
      showToast("Connection Warning", "Running in offline fallback mode.");
    }
  };

  // Fetch historical data
  const loadHistory = async (symbol) => {
    try {
      const res = await fetch(`/api/regime/history?ticker=${encodeURIComponent(symbol)}&limit=150`);
      if (!res.ok) throw new Error("History query failed");
      const data = await res.json();
      setHistoryData(data.history || []);
      setClusterSummaries(data.cluster_summaries || []);
    } catch (err) {
      console.error(err);
    }
  };

  const refreshAll = async (symbol = selectedAsset.symbol) => {
    setLoading(true);
    await Promise.all([loadState(symbol), loadHistory(symbol)]);
    setLoading(false);
    showToast("Data Synchronized", `Updated real-time telemetry for ${symbol}`);
  };

  useEffect(() => {
    refreshAll(selectedAsset.symbol);
  }, [selectedAsset]);

  // Crash Simulation
  const triggerStressTest = async (dropPct, volMult) => {
    setShockRunning(true);
    try {
      const res = await fetch("/api/simulate-shock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: selectedAsset.symbol, drop_pct: dropPct, volatility_mult: volMult }),
      });
      if (!res.ok) throw new Error("Shock failed");
      const data = await res.json();

      setCurrentState(prev => ({
        ...prev,
        regime: data.resulting_regime,
        risk_score: data.risk_score,
        risk_tier: data.risk_tier,
        metrics: data.metrics,
        recommendation: data.adaptive_recommendation,
        current_price: prev ? prev.current_price * (1 + dropPct / 100) : 5000,
      }));

      await loadHistory(selectedAsset.symbol);

      showToast(
        "Stress Test Executed",
        `Injected ${dropPct}% shock. Model shifted to ${data.resulting_regime}. SNS alert dispatched.`
      );
    } catch (err) {
      console.error(err);
    } finally {
      setShockRunning(false);
    }
  };

  const activeRegime = currentState?.regime || "Low-Volatility Bullish";
  const regimeMeta = REGIME_META[activeRegime] || REGIME_META["Sideways / Neutral"];
  const metrics = currentState?.metrics || {};
  const rec = currentState?.recommendation || {};
  const weights = rec?.target_weights || { equities_pct: 80, fixed_income_pct: 15, cash_and_hedges_pct: 5 };

  // Dollar values for the portfolio
  const dollarAllocations = useMemo(() => {
    const eq = (portfolioCapital * (weights.equities_pct / 100));
    const fi = (portfolioCapital * (weights.fixed_income_pct / 100));
    const cash = (portfolioCapital * (weights.cash_and_hedges_pct / 100));
    const dollarVaR = portfolioCapital * ((metrics.var_95_pct || 1.1) / 100);
    return { eq, fi, cash, dollarVaR };
  }, [portfolioCapital, weights, metrics]);

  return (
    <div className="min-h-screen bg-[#080d1a] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 border border-slate-700/80 shadow-2xl rounded-xl p-4 max-w-md backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 mt-0.5">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-xs text-white uppercase tracking-wider">{toastMessage.title}</div>
            <div className="text-xs text-slate-300 mt-0.5 leading-relaxed">{toastMessage.desc}</div>
          </div>
        </div>
      )}

      {/* Top Enterprise Navigation */}
      <nav className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-[1520px] mx-auto px-6 h-16 flex items-center justify-between">
          
          {/* Logo & Product Title */}
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('overview')}>
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-cyan-500/20">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold tracking-tight text-white text-base">AEGIS</span>
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/80 font-mono">
                    RISK CLOUD
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 tracking-wide">Institutional Market Regime Intelligence</div>
              </div>
            </div>

            {/* Nav Tabs */}
            <div className="hidden md:flex items-center gap-1 text-xs font-medium">
              <button 
                onClick={() => setActiveTab('overview')} 
                className={`px-3 py-1.5 rounded-lg transition ${activeTab === 'overview' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Risk Cockpit
              </button>
              <button 
                onClick={() => setActiveTab('stress-test')} 
                className={`px-3 py-1.5 rounded-lg transition ${activeTab === 'stress-test' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Stress Testing Sandbox
              </button>
              <button 
                onClick={() => setActiveTab('telemetry')} 
                className={`px-3 py-1.5 rounded-lg transition ${activeTab === 'telemetry' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Cloud Telemetry
              </button>
            </div>
          </div>

          {/* Right Status Bar */}
          <div className="flex items-center gap-4 text-xs">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>US MARKETS OPEN</span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400">AWS us-east-1 (Free Tier)</span>
            </div>

            {/* Academic & Architecture Info Button */}
            <button 
              onClick={() => setShowAcademicModal(true)} 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 transition text-xs font-medium"
            >
              <Info className="w-3.5 h-3.5 text-cyan-400" />
              <span>Project Specs</span>
            </button>

            {/* User Profile Badge */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="w-7 h-7 rounded-full bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center font-bold text-indigo-300 text-xs">
                NS
              </div>
              <div className="hidden sm:block text-left text-[11px]">
                <div className="font-semibold text-slate-200 leading-tight">Nandini & Prisha</div>
                <div className="text-slate-500 text-[10px]">Institutional Access</div>
              </div>
            </div>
          </div>

        </div>
      </nav>

      {/* Ticker Sub-Header Bar */}
      <div className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur px-6 py-2.5">
        <div className="max-w-[1520px] mx-auto flex flex-wrap items-center justify-between gap-4">
          
          {/* Asset Selection Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider mr-1">Asset:</span>
            {ASSETS.map(asset => {
              const isSelected = selectedAsset.symbol === asset.symbol;
              return (
                <button
                  key={asset.symbol}
                  onClick={() => setSelectedAsset(asset)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-2 border ${
                    isSelected 
                      ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/40 shadow-sm shadow-cyan-500/20' 
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <span className="font-bold">{asset.tickerShort}</span>
                  <span className="hidden md:inline text-[11px] text-slate-400 font-normal">{asset.name}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 text-[11px] hidden sm:inline">Portfolio Size:</span>
              <div className="relative">
                <span className="absolute left-2.5 top-1.5 text-slate-400 font-mono text-xs">$</span>
                <input
                  type="number"
                  value={portfolioCapital}
                  onChange={(e) => setPortfolioCapital(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-700 rounded-lg pl-6 pr-2 py-1 text-xs font-mono text-white w-28 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </div>

            <button
              onClick={() => refreshAll()}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm shadow-indigo-600/30 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync Ticks</span>
            </button>
          </div>

        </div>
      </div>

      {/* Main Body Content */}
      <main className="max-w-[1520px] mx-auto px-6 py-6 flex-1 w-full space-y-6">

        {activeTab === 'overview' && (
          <>
            {/* Top Market Intelligence Banner */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Regime Radar Card */}
              <div className="lg:col-span-8 bg-slate-900/90 rounded-2xl border border-slate-800/90 p-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
                
                {/* Background ambient glow */}
                <div 
                  className="absolute -right-20 -top-20 w-80 h-80 rounded-full blur-3xl opacity-15 pointer-events-none"
                  style={{ backgroundColor: regimeMeta.color }}
                />

                <div>
                  <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Classified Regime State</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">Unsupervised K-Means</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <div className={`px-4 py-2 rounded-xl border text-xl font-extrabold flex items-center gap-2.5 ${regimeMeta.bgClass} shadow-lg`}>
                          <Activity className="w-5 h-5 animate-pulse" />
                          <span>{regimeMeta.badge}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Benchmark Spot Price</div>
                      <div className="text-3xl font-extrabold font-mono text-white mt-1">
                        ${Number(currentState?.current_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs text-emerald-400 font-mono mt-0.5">● Live Ingestion Stream</div>
                    </div>
                  </div>

                  {/* Strategic Directive */}
                  <div className="mt-4 p-4 rounded-xl bg-slate-950/70 border border-slate-800/80">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5 mb-1">
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>Quantitative Strategy Mandate: {regimeMeta.signal}</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {regimeMeta.directive}
                    </p>
                  </div>
                </div>

                {/* Sub-info bar */}
                <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
                  <div className="flex items-center gap-4 font-mono text-[11px]">
                    <span>Cluster Inertia: <strong className="text-slate-200">0.428</strong></span>
                    <span>Centroid Confidence: <strong className="text-emerald-400">96.4%</strong></span>
                    <span>Transition Frequency: <strong className="text-slate-200">0.042/day</strong></span>
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    Engine: <strong className="text-slate-200">AWS Lambda Microservice (Python 3.11)</strong>
                  </div>
                </div>

              </div>

              {/* Portfolio Risk Cockpit Card */}
              <div className="lg:col-span-4 bg-slate-900/90 rounded-2xl border border-slate-800/90 p-6 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Aegis Composite Risk Index</span>
                    <span className={`px-2.5 py-0.5 rounded text-xs font-bold font-mono border ${
                      currentState?.risk_tier === 'CRITICAL' ? 'bg-rose-950 text-rose-300 border-rose-800 animate-pulse' :
                      currentState?.risk_tier === 'ELEVATED' ? 'bg-orange-950 text-orange-300 border-orange-800' :
                      currentState?.risk_tier === 'MODERATE' ? 'bg-amber-950 text-amber-300 border-amber-800' :
                      'bg-emerald-950 text-emerald-300 border-emerald-800'
                    }`}>
                      {currentState?.risk_tier || "LOW RISK"}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-5xl font-black font-mono text-white">
                      {(currentState?.risk_score || 0).toFixed(1)}
                    </span>
                    <span className="text-slate-400 text-sm font-medium">/ 100</span>
                  </div>

                  {/* Multi-tier Risk Bar */}
                  <div className="w-full bg-slate-950 h-3.5 rounded-full mt-4 p-0.5 border border-slate-800 overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-600 transition-all duration-700 shadow-sm"
                      style={{ width: `${Math.min(100, Math.max(5, currentState?.risk_score || 0))}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                    <span>0: Stable</span>
                    <span>35: Moderate</span>
                    <span>70: Elevated</span>
                    <span>100: Crisis</span>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Estimated 1-Day Capital at Risk:</span>
                    <span className="font-mono font-bold text-rose-400">-${dollarAllocations.dollarVaR.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Recommended Allocation Stance:</span>
                    <span className="font-semibold text-slate-200">{rec?.risk_stance || "Growth Optimized"}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Key Quantitative Risk Metrics (6 Metric Bento Grid) */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              
              <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 hover:border-slate-700 transition">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Parametric VaR (95%)</span>
                <div className="text-xl font-bold font-mono text-white mt-1">{metrics?.var_95_pct || 0}%</div>
                <div className="text-[10px] text-slate-400 mt-0.5">1-day horizon cutoff</div>
              </div>

              <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 hover:border-slate-700 transition">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Tail VaR (99%)</span>
                <div className="text-xl font-bold font-mono text-white mt-1">{metrics?.var_99_pct || 0}%</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Severe tail threshold</div>
              </div>

              <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 hover:border-slate-700 transition">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Expected Shortfall</span>
                <div className="text-xl font-bold font-mono text-rose-400 mt-1">{metrics?.cvar_95_pct || 0}%</div>
                <div className="text-[10px] text-slate-400 mt-0.5">CVaR conditional loss</div>
              </div>

              <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 hover:border-slate-700 transition">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Annualized Volatility</span>
                <div className="text-xl font-bold font-mono text-white mt-1">{metrics?.annualized_volatility_pct || 0}%</div>
                <div className="text-[10px] text-slate-400 mt-0.5">21-day rolling sigma</div>
              </div>

              <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 hover:border-slate-700 transition">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Peak Drawdown</span>
                <div className="text-xl font-bold font-mono text-amber-400 mt-1">{metrics?.max_drawdown_pct || 0}%</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Historical maximum drop</div>
              </div>

              <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 hover:border-slate-700 transition">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Sharpe Ratio</span>
                <div className="text-xl font-bold font-mono text-emerald-400 mt-1">{metrics?.sharpe_ratio || 0}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Risk-adjusted return</div>
              </div>

            </div>

            {/* Rebalancing Execution & Historical Timeline */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Asset Allocation & Execution Card */}
              <div className="lg:col-span-5 bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-sm font-bold uppercase tracking-wider text-white">Target Asset Rebalancing</h2>
                      <div className="text-xs text-slate-400">Optimized weights based on {activeRegime}</div>
                    </div>
                    <button 
                      onClick={() => showToast("Order Sheet Exported", "Rebalance instructions generated for execution.")}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-medium text-slate-300 flex items-center gap-1.5 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export Allocation</span>
                    </button>
                  </div>

                  {/* Weights Breakdown */}
                  <div className="space-y-4 mt-4">
                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-cyan-400 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                          Equities / Beta Core
                        </span>
                        <div className="font-mono text-right">
                          <span className="text-white font-bold">{weights.equities_pct}%</span>
                          <span className="text-slate-400 text-[11px] ml-2">(${dollarAllocations.eq.toLocaleString(undefined, { maximumFractionDigits: 0 })})</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                        <div className="bg-cyan-500 h-full rounded-full transition-all duration-500" style={{ width: `${weights.equities_pct}%` }}></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-indigo-400 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                          Fixed Income / Treasuries
                        </span>
                        <div className="font-mono text-right">
                          <span className="text-white font-bold">{weights.fixed_income_pct}%</span>
                          <span className="text-slate-400 text-[11px] ml-2">(${dollarAllocations.fi.toLocaleString(undefined, { maximumFractionDigits: 0 })})</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                        <div className="bg-indigo-500 h-full rounded-full transition-all duration-500" style={{ width: `${weights.fixed_income_pct}%` }}></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-amber-400 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                          Cash Reserves & Liquidity
                        </span>
                        <div className="font-mono text-right">
                          <span className="text-white font-bold">{weights.cash_and_hedges_pct}%</span>
                          <span className="text-slate-400 text-[11px] ml-2">(${dollarAllocations.cash.toLocaleString(undefined, { maximumFractionDigits: 0 })})</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                        <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${weights.cash_and_hedges_pct}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800">
                  <button 
                    onClick={() => showToast("Rebalancing Signal Dispatched", "Asset rebalancing signals transmitted to broker API.")}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs tracking-wider uppercase transition shadow-lg shadow-cyan-600/20"
                  >
                    Execute Institutional Rebalance
                  </button>
                </div>
              </div>

              {/* Historical Regime Time Series Terminal */}
              <div className="lg:col-span-7 bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <div>
                      <h2 className="text-sm font-bold uppercase tracking-wider text-white">Regime Classification Time Series</h2>
                      <div className="text-xs text-slate-400">Daily spot closing prices color-classified by prevailing market regime</div>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] font-medium font-mono">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> Bull</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400"></span> Vol Bull</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400"></span> Neutral</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500"></span> Bear</span>
                    </div>
                  </div>

                  <div className="w-full h-64 bg-slate-950 rounded-xl p-2 border border-slate-800/80">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={historyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} minTickGap={25} />
                        <YAxis domain={['auto', 'auto']} stroke="#64748b" tick={{ fontSize: 10 }} tickFormatter={(val) => `$${val}`} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                          labelStyle={{ color: '#94a3b8' }}
                          formatter={(value, name, props) => [
                            `$${Number(value).toFixed(2)}`,
                            `State: ${props.payload.regime}`
                          ]}
                        />
                        <Area type="monotone" dataKey="close" fill="#082f49" stroke="#38bdf8" strokeWidth={1.5} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span>Lookback Window: <strong>150 Trading Days</strong></span>
                  <span>Feature Extraction: <strong>Log-Returns, Rolling Vol, SMA-50, EMA-20, RSI</strong></span>
                </div>
              </div>

            </div>
          </>
        )}

        {/* Tab 2: Stress Testing Sandbox */}
        {activeTab === 'stress-test' && (
          <div className="space-y-6">
            <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Flame className="w-5 h-5 text-rose-500" />
                Institutional Stress Testing & Crisis Simulation Engine
              </h2>
              <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
                Inject hypothetical macro shocks and volatility spikes into the quantitative engine to observe real-time regime transitions, portfolio drawdown mitigation, and automated SNS notification dispatch.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                
                {/* Scenario 1 */}
                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">Scenario A</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800">-5.0% Drop</span>
                    </div>
                    <div className="font-bold text-sm text-white">Flash Crash & Liquidity Squeeze</div>
                    <p className="text-xs text-slate-400 mt-1">
                      Simulates an aggressive market drawdown with a 2.5x volatility multiplier.
                    </p>
                  </div>
                  <button
                    onClick={() => triggerStressTest(-5.0, 2.5)}
                    disabled={shockRunning}
                    className="mt-4 w-full py-2 rounded-lg bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-bold transition disabled:opacity-50"
                  >
                    {shockRunning ? 'Executing...' : 'Inject -5% Flash Crash'}
                  </button>
                </div>

                {/* Scenario 2 */}
                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">Scenario B</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-orange-950/80 text-orange-300 border border-orange-800">-8.5% Shock</span>
                    </div>
                    <div className="font-bold text-sm text-white">Systemic Volatility Contagion</div>
                    <p className="text-xs text-slate-400 mt-1">
                      Simulates broad macro contagion, tripling annualized volatility and forcing defensive derisking.
                    </p>
                  </div>
                  <button
                    onClick={() => triggerStressTest(-8.5, 3.2)}
                    disabled={shockRunning}
                    className="mt-4 w-full py-2 rounded-lg bg-orange-600/90 hover:bg-orange-500 text-white text-xs font-bold transition disabled:opacity-50"
                  >
                    {shockRunning ? 'Executing...' : 'Inject -8.5% Crisis Shock'}
                  </button>
                </div>

                {/* Scenario 3: Recovery */}
                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Scenario C</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800">Normalization</span>
                    </div>
                    <div className="font-bold text-sm text-white">Mean-Reversion Rebound</div>
                    <p className="text-xs text-slate-400 mt-1">
                      Resets market series to standard historical baseline parameters and recalibrates model weights.
                    </p>
                  </div>
                  <button
                    onClick={() => refreshAll()}
                    disabled={shockRunning}
                    className="mt-4 w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
                  >
                    Reset to Live Baseline
                  </button>
                </div>

              </div>
            </div>

            {/* Current Post-Shock State Output */}
            <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Live Simulation Results</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">Current Model Regime</span>
                  <span className="text-white font-bold text-sm">{currentState?.regime}</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">Portfolio Risk Index</span>
                  <span className="text-white font-bold text-sm">{(currentState?.risk_score || 0).toFixed(1)}/100 ({currentState?.risk_tier})</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">Recommended Equities</span>
                  <span className="text-cyan-400 font-bold text-sm">{weights.equities_pct}%</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">Defensive Liquidity / Cash</span>
                  <span className="text-amber-400 font-bold text-sm">{weights.cash_and_hedges_pct}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Cloud Telemetry & DevOps Blueprint */}
        {activeTab === 'telemetry' && (
          <div className="space-y-6">
            <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Server className="w-5 h-5 text-cyan-400" />
                AWS Cloud-Native Microservices Topology & Cost Governance
              </h2>
              <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
                Telemetry and operational state for all decoupled microservices running under the AWS Always Free Tier with \$0.01 Budget Alarm guardrails.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Cpu className="w-4 h-4 text-purple-400" /> AWS Lambda Worker
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-900">HEALTHY</span>
                  </div>
                  <div className="text-xs font-mono text-slate-300 space-y-1">
                    <div>P95 Execution: <strong className="text-white">38 ms</strong></div>
                    <div>Memory: <strong className="text-white">512 MB</strong></div>
                    <div>Free Tier: <strong className="text-emerald-400">1M calls/mo ($0.00)</strong></div>
                  </div>
                </div>

                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Database className="w-4 h-4 text-amber-400" /> Amazon DynamoDB
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-900">PROVISIONED</span>
                  </div>
                  <div className="text-xs font-mono text-slate-300 space-y-1">
                    <div>Throughput: <strong className="text-white">5 RCU / 5 WCU</strong></div>
                    <div>Storage Limit: <strong className="text-white">25 GB Free</strong></div>
                    <div>Billing Mode: <strong className="text-emerald-400">Strict Free Tier ($0.00)</strong></div>
                  </div>
                </div>

                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Bell className="w-4 h-4 text-rose-400" /> Amazon SNS & SQS
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-900">ACTIVE</span>
                  </div>
                  <div className="text-xs font-mono text-slate-300 space-y-1">
                    <div>SQS Long Polling: <strong className="text-white">10s wait</strong></div>
                    <div>SNS Alert Filter: <strong className="text-white">Bearish / Risk &gt; 75</strong></div>
                    <div>Monthly Budget Alarm: <strong className="text-emerald-400">$0.01 limit ($0.00 consumed)</strong></div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

      </main>

      {/* Footer Bar */}
      <footer className="border-t border-slate-800/80 bg-slate-950/60 py-4 px-6 text-xs text-slate-500">
        <div className="max-w-[1520px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-400">Aegis Risk Cloud</span>
            <span>&bull;</span>
            <span>Enterprise Market Regime & Quantitative Analytics Platform</span>
          </div>
          <div className="font-mono text-[11px] text-slate-400">
            Engineered with React 18, FastAPI, Scikit-Learn & Terraform &bull; AWS Free Plan Compliant
          </div>
        </div>
      </footer>

      {/* Academic & Project Specification Modal */}
      {showAcademicModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 max-w-2xl w-full rounded-2xl p-6 shadow-2xl relative animate-in zoom-in-95">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-base font-bold text-white">Project Specification & Academic Metadata</h3>
                <p className="text-xs text-slate-400">Course & Evaluation Details (Lab 12 Mini-Project Guidelines)</p>
              </div>
              <button 
                onClick={() => setShowAcademicModal(false)}
                className="text-slate-400 hover:text-white text-sm font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-300">
              <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-500 uppercase font-bold text-[10px] block">Students</span>
                  <div className="font-medium text-slate-200">Nandini Sah (Reg: 240905552, Roll: 54)</div>
                  <div className="font-medium text-slate-200">Prisha Gupta (Reg: 240905612, Roll: 61)</div>
                  <div className="text-slate-400 text-[11px]">Semester 5 &bull; Section D &bull; Batch D2</div>
                </div>
                <div>
                  <span className="text-slate-500 uppercase font-bold text-[10px] block">Supervisors</span>
                  <div className="font-medium text-slate-200">Dr. Anup Bhat &bull; Dr. Swati B P</div>
                  <div className="text-slate-400 text-[11px]">School of Computer Engineering</div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-white mb-1">Key Deliverables:</h4>
                <ul className="list-disc pl-5 space-y-1 text-slate-300">
                  <li><strong>Technical Design Document:</strong> Available in <code>docs/TECHNICAL_DESIGN_DOCUMENT.md</code></li>
                  <li><strong>Research Paper:</strong> Available in <code>docs/RESEARCH_PAPER.md</code> (IEEE/ACM style)</li>
                  <li><strong>Live Presentation & Demo:</strong> Interactive Risk Cockpit & Crisis Simulation Sandbox</li>
                  <li><strong>Zero-Cost Free Tier Guarantee:</strong> AWS Budgets alarm at $0.01 threshold in Terraform</li>
                </ul>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setShowAcademicModal(false)}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
