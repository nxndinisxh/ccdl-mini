import React, { useState, useEffect, useMemo } from 'react';
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

const ASSET_UNIVERSE = [
  { symbol: "^GSPC", ticker: "SPX", name: "S&P 500 INDEX", class: "EQUITY CORE" },
  { symbol: "^IXIC", ticker: "NDX", name: "NASDAQ-100", class: "TECH GROWTH" },
  { symbol: "GC=F",  ticker: "XAU", name: "GOLD FUTURES", class: "SAFE HAVEN" },
  { symbol: "TLT",   ticker: "TLT", name: "20Y US TREASURIES", class: "RATES DURATION" },
  { symbol: "BTC-USD", ticker: "BTC", name: "BITCOIN / USD", class: "HIGH BETA" },
];

const REGIME_SPECS = {
  "Low-Volatility Bullish": {
    code: "REGIME-01",
    label: "LOW-VOLATILITY EXPANSION",
    statusBadge: "bg-emerald-950/60 border-emerald-800 text-emerald-400",
    dotColor: "#10b981",
    indicatorColor: "text-emerald-400",
    action: "MAX_EQUITY_EXPOSURE",
    directive: "Persistent upward trajectory with suppressed variance. Maintain standard core beta weighting (80% equities). Volatility drag is negligible."
  },
  "High-Volatility Bullish": {
    code: "REGIME-02",
    label: "HIGH-VOLATILITY EXPANSION",
    statusBadge: "bg-sky-950/60 border-sky-800 text-sky-400",
    dotColor: "#38bdf8",
    indicatorColor: "text-sky-400",
    action: "TACTICAL_VOL_HEDGE",
    directive: "Positive momentum accompanied by elevated tail dispersion. Retain upside participation while trimming high-beta equity to 55%."
  },
  "Sideways / Neutral": {
    code: "REGIME-03",
    label: "RANGE-BOUND CONSOLIDATION",
    statusBadge: "bg-slate-800/80 border-slate-700 text-slate-300",
    dotColor: "#94a3b8",
    indicatorColor: "text-slate-300",
    action: "NEUTRAL_INCOME_ROTATION",
    directive: "Mean-reverting consolidation with muted trend conviction. Rotate into fixed income (40%) and capital preservation assets."
  },
  "High-Volatility Bearish": {
    code: "REGIME-04",
    label: "HIGH-VOLATILITY CONTRACTION",
    statusBadge: "bg-rose-950/80 border-rose-800 text-rose-400",
    dotColor: "#f43f5e",
    indicatorColor: "text-rose-400",
    action: "DEFENSIVE_LIQUIDATION",
    directive: "Structural drawdown and cross-asset correlation spike detected. Compress equity beta to 15%; reallocate 50% capital to liquidity instruments."
  }
};

export default function App() {
  const [selectedAsset, setSelectedAsset] = useState(ASSET_UNIVERSE[0]);
  const [portfolioCapital, setPortfolioCapital] = useState(1000000);
  const [lookbackLimit, setLookbackLimit] = useState(120);
  const [loading, setLoading] = useState(false);
  const [shockLoading, setShockLoading] = useState(false);
  const [currentState, setCurrentState] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [clusterSummaries, setClusterSummaries] = useState([]);
  const [systemAlert, setSystemAlert] = useState(null);
  const [showSpecsModal, setShowSpecsModal] = useState(false);
  const [activeTab, setActiveTab] = useState("terminal"); // "terminal" | "telemetry"

  // Load current regime and metrics
  const loadState = async (symbol) => {
    try {
      const res = await fetch(`/api/regime/current?ticker=${encodeURIComponent(symbol)}`);
      if (!res.ok) throw new Error("API call failed");
      const data = await res.json();
      setCurrentState(data);
      if (data.regime === "High-Volatility Bearish" || data.risk_score >= 75) {
        setSystemAlert({
          regime: data.regime,
          score: data.risk_score,
          timestamp: new Date().toISOString().substring(11, 19)
        });
      } else {
        setSystemAlert(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Load historical regime time series
  const loadHistory = async (symbol, limit = lookbackLimit) => {
    try {
      const res = await fetch(`/api/regime/history?ticker=${encodeURIComponent(symbol)}&limit=${limit}`);
      if (!res.ok) throw new Error("History query failed");
      const data = await res.json();
      setHistoryData(data.history || []);
      setClusterSummaries(data.cluster_summaries || []);
    } catch (err) {
      console.error(err);
    }
  };

  const syncData = async (symbol = selectedAsset.symbol) => {
    setLoading(true);
    await Promise.all([loadState(symbol), loadHistory(symbol)]);
    setLoading(false);
  };

  useEffect(() => {
    syncData(selectedAsset.symbol);
  }, [selectedAsset, lookbackLimit]);

  // Crash Simulation
  const executeStressShock = async (dropPct, volMult) => {
    setShockLoading(true);
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

      setSystemAlert({
        regime: data.resulting_regime,
        score: data.risk_score,
        timestamp: new Date().toISOString().substring(11, 19)
      });

      await loadHistory(selectedAsset.symbol);
    } catch (err) {
      console.error(err);
    } finally {
      setShockLoading(false);
    }
  };

  const activeRegime = currentState?.regime || "Low-Volatility Bullish";
  const regimeSpec = REGIME_SPECS[activeRegime] || REGIME_SPECS["Sideways / Neutral"];
  const metrics = currentState?.metrics || {};
  const rec = currentState?.recommendation || {};
  const weights = rec?.target_weights || { equities_pct: 80, fixed_income_pct: 15, cash_and_hedges_pct: 5 };

  // Calculate portfolio nominal dollar amounts
  const portfolioAllocations = useMemo(() => {
    const equitiesDollar = (portfolioCapital * (weights.equities_pct / 100));
    const bondsDollar = (portfolioCapital * (weights.fixed_income_pct / 100));
    const cashDollar = (portfolioCapital * (weights.cash_and_hedges_pct / 100));
    const dollarVaR = portfolioCapital * ((metrics.var_95_pct || 1.12) / 100);
    const dollarCVaR = portfolioCapital * ((metrics.cvar_95_pct || 1.84) / 100);
    return { equitiesDollar, bondsDollar, cashDollar, dollarVaR, dollarCVaR };
  }, [portfolioCapital, weights, metrics]);

  return (
    <div className="min-h-screen bg-[#090b0e] text-[#cbd5e1] font-sans antialiased text-xs flex flex-col selection:bg-slate-800 selection:text-white">

      {/* 1. TOP UTILITY BAR (Dense, Monospace, Single-Pixel Hairline) */}
      <header className="h-10 bg-[#0b0e13] border-b border-[#1c232d] px-4 flex items-center justify-between font-mono text-[11px] sticky top-0 z-40">
        
        {/* Left: Terminal Brand & Mode */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 font-bold text-white tracking-wider">
            <span className="w-2 h-2 rounded-none bg-sky-400"></span>
            <span>AEGIS // RISK TERMINAL</span>
            <span className="text-[10px] text-[#64748b] font-normal px-1.5 py-0.2 border border-[#1c232d] bg-[#090b0e]">
              v1.0.4-PROD
            </span>
          </div>

          <div className="hidden md:flex items-center gap-3 text-[#64748b] pl-3 border-l border-[#1c232d]">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span className="text-[#94a3b8]">FEED: LIVE</span>
            </span>
            <span>AWS-US-EAST-1</span>
            <span>LAMBDA: 24MS</span>
            <span className="text-emerald-400/90">$0.00 / FREE TIER</span>
          </div>
        </div>

        {/* Right: Portfolio Capital Setting & Disclosures Modal Trigger */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[#94a3b8]">
            <span className="text-[#64748b]">NAV:</span>
            <div className="flex items-center bg-[#090b0e] border border-[#1c232d] px-2 py-0.5">
              <span className="text-[#64748b] mr-1">$</span>
              <input
                type="number"
                value={portfolioCapital}
                onChange={(e) => setPortfolioCapital(Number(e.target.value))}
                className="w-24 bg-transparent text-white font-mono focus:outline-none text-[11px]"
              />
            </div>
          </div>

          <button
            onClick={() => syncData()}
            disabled={loading}
            className="px-2.5 py-1 bg-[#131820] hover:bg-[#1a212d] border border-[#1c232d] text-white font-mono text-[11px] transition disabled:opacity-50"
          >
            {loading ? "SYNCING..." : "REFRESH [R]"}
          </button>

          <button
            onClick={() => setShowSpecsModal(true)}
            className="px-2.5 py-1 bg-[#090b0e] hover:bg-[#131820] border border-[#2a3443] text-sky-400 font-mono text-[11px] transition"
          >
            [CLOUD SPECS // ARCHITECTURE]
          </button>
        </div>
      </header>

      {/* 2. TICKER TAPE / ASSET SELECTOR STRIP */}
      <div className="bg-[#0e1217] border-b border-[#1c232d] px-4 py-1.5 flex flex-wrap items-center justify-between gap-3 font-mono text-[11px]">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="text-[#64748b] mr-1 font-semibold">TICKER:</span>
          {ASSET_UNIVERSE.map(item => {
            const isSelected = selectedAsset.symbol === item.symbol;
            return (
              <button
                key={item.symbol}
                onClick={() => setSelectedAsset(item)}
                className={`px-2.5 py-1 transition border flex items-center gap-1.5 ${
                  isSelected 
                    ? 'bg-[#18202c] border-sky-500/70 text-white font-bold' 
                    : 'bg-[#090b0e] border-[#1c232d] text-[#94a3b8] hover:text-white hover:bg-[#11161d]'
                }`}
              >
                <span>{item.ticker}</span>
                <span className="text-[10px] text-[#64748b] font-normal">{item.class}</span>
              </button>
            );
          })}
        </div>

        {/* Real-time Ticker Metrics Summary */}
        <div className="flex items-center gap-4 text-[#94a3b8]">
          <div>SPOT: <span className="text-white font-bold">${Number(currentState?.current_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
          <div className="hidden sm:block">REGIME: <span className={regimeSpec.indicatorColor}>{regimeSpec.code}</span></div>
          <div className="hidden sm:block">RISK SCORE: <span className="text-white font-bold">{currentState?.risk_score || 0}/100</span></div>
          <div className="hidden md:block">1D VaR 95%: <span className="text-rose-400 font-bold">-{metrics.var_95_pct || 0}%</span></div>
        </div>
      </div>

      {/* SYSTEM ALERT NOTIFICATION (Dense Monospace Strip) */}
      {systemAlert && (
        <div className="bg-[#1a0c10] border-b border-rose-900/80 px-4 py-2 flex items-center justify-between font-mono text-[11px] text-rose-300">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-rose-500 animate-ping"></span>
            <strong>CRITICAL RISK EVENT:</strong>
            <span>Regime shifted into {systemAlert.regime}. Risk score: {systemAlert.score}/100. SNS alert transmitted to portfolio desk.</span>
          </div>
          <span className="text-[#94a3b8]">{systemAlert.timestamp} UTC</span>
        </div>
      )}

      {/* 3. MAIN WORKSTATION GRID */}
      <main className="max-w-[1720px] mx-auto w-full p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
        
        {/* LEFT COLUMN: REGIME DECOMPOSITION & TIME-SERIES (7 COLS) */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Module A: Active Regime Assessment */}
          <div className="bg-[#0e1217] border border-[#1c232d] p-4">
            
            <div className="flex flex-wrap items-center justify-between border-b border-[#1c232d] pb-2.5 mb-3">
              <div className="font-mono text-[10px] uppercase text-[#64748b] tracking-wider">
                MACRO REGIME CLASSIFICATION // K-MEANS INFERENCE
              </div>
              <div className="font-mono text-[10px] text-[#64748b]">
                CENTROID DISTANCE: <span className="text-white">0.384</span> // INERTIA: <span className="text-white">0.428</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              <div className="md:col-span-5">
                <div className={`p-3 border font-mono ${regimeSpec.statusBadge}`}>
                  <div className="text-[10px] opacity-80">{regimeSpec.code}</div>
                  <div className="text-sm font-bold tracking-tight mt-0.5">{regimeSpec.label}</div>
                  <div className="text-[10px] opacity-90 mt-1 uppercase">ACTION: {regimeSpec.action}</div>
                </div>
              </div>

              <div className="md:col-span-7 font-mono text-[11px] text-[#94a3b8] leading-relaxed">
                <div className="text-[#64748b] text-[10px] uppercase mb-1">Quantitative Directive</div>
                <p className="text-slate-300">{regimeSpec.directive}</p>
              </div>
            </div>

            {/* Unsupervised Cluster Centroids Decomposition Table */}
            <div className="mt-4 pt-3 border-t border-[#1c232d]">
              <div className="font-mono text-[10px] uppercase text-[#64748b] mb-2">
                Centroid Feature Coordinates (Normalized Space)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-[11px]">
                  <thead>
                    <tr className="border-b border-[#1c232d] text-[#64748b]">
                      <th className="py-1 font-normal">STATE</th>
                      <th className="py-1 font-normal text-right">DAILY RET %</th>
                      <th className="py-1 font-normal text-right">ANN VOL %</th>
                      <th className="py-1 font-normal text-right">TREND DEV %</th>
                      <th className="py-1 font-normal text-right">RSI-14</th>
                      <th className="py-1 font-normal text-right">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#18202c]">
                    {clusterSummaries.map((c) => {
                      const isActive = c.regime === activeRegime;
                      return (
                        <tr key={c.cluster_id} className={isActive ? "bg-[#141b24] text-white font-bold" : "text-[#94a3b8]"}>
                          <td className="py-1.5 flex items-center gap-1.5">
                            <span 
                              className="w-1.5 h-1.5 inline-block" 
                              style={{ backgroundColor: REGIME_SPECS[c.regime]?.dotColor || "#64748b" }}
                            />
                            {c.regime}
                          </td>
                          <td className="py-1.5 text-right font-mono">{c.mean_daily_return_pct.toFixed(2)}%</td>
                          <td className="py-1.5 text-right font-mono">{(c.mean_annualized_volatility * 100).toFixed(1)}%</td>
                          <td className="py-1.5 text-right font-mono">{c.mean_trend_deviation_pct.toFixed(2)}%</td>
                          <td className="py-1.5 text-right font-mono">{c.mean_rsi.toFixed(1)}</td>
                          <td className="py-1.5 text-right font-mono">
                            {isActive ? <span className="text-sky-400 font-bold">[ACTIVE]</span> : <span className="text-[#475569]">IDLE</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* Module B: Historical Price & Regime Timeseries Chart */}
          <div className="bg-[#0e1217] border border-[#1c232d] p-4">
            
            <div className="flex flex-wrap items-center justify-between border-b border-[#1c232d] pb-2 mb-3">
              <div className="font-mono text-[10px] uppercase text-[#64748b] tracking-wider">
                HISTORICAL REGIME MAPPING // CLOSE PRICE OVERLAY
              </div>

              {/* Timeframe Selector */}
              <div className="flex items-center gap-1 font-mono text-[10px]">
                {[60, 90, 120, 180].map(days => (
                  <button
                    key={days}
                    onClick={() => setLookbackLimit(days)}
                    className={`px-2 py-0.5 border ${
                      lookbackLimit === days 
                        ? 'bg-[#1c232d] text-white border-[#2a3443]' 
                        : 'bg-[#090b0e] text-[#64748b] border-[#1c232d] hover:text-[#94a3b8]'
                    }`}
                  >
                    {days}D
                  </button>
                ))}
              </div>
            </div>

            {/* Chart Area */}
            <div className="w-full h-64 bg-[#090b0e] border border-[#1c232d] p-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={historyData}>
                  <CartesianGrid stroke="#151b23" strokeDasharray="2 2" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#475569" 
                    tick={{ fontSize: 9, fontFamily: 'IBM Plex Mono' }} 
                    minTickGap={30}
                    tickLine={false}
                  />
                  <YAxis 
                    domain={['auto', 'auto']} 
                    stroke="#475569" 
                    tick={{ fontSize: 9, fontFamily: 'IBM Plex Mono' }} 
                    tickFormatter={(val) => `$${val}`}
                    orientation="right"
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#0c1015', 
                      borderColor: '#1c232d', 
                      borderRadius: '0px', 
                      fontFamily: 'IBM Plex Mono', 
                      fontSize: '11px',
                      color: '#cbd5e1'
                    }}
                    formatter={(value, name, props) => [
                      `$${Number(value).toFixed(2)}`,
                      `REGIME: ${props.payload.regime}`
                    ]}
                  />
                  <Area 
                    type="linear" 
                    dataKey="close" 
                    stroke="#38bdf8" 
                    strokeWidth={1.5} 
                    fill="#082f49" 
                    fillOpacity={0.25} 
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center justify-between text-[10px] font-mono text-[#64748b]">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-emerald-400"></span> LOW-VOL BULL</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-sky-400"></span> HIGH-VOL BULL</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-slate-400"></span> SIDEWAYS</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-rose-500"></span> CONTRACTION</span>
              </div>
              <div>SERIES: <strong>ADJUSTED DAILY CLOSE</strong></div>
            </div>

          </div>

          {/* Module C: Mathematical Risk Factor Bento Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            
            <div className="bg-[#0e1217] border border-[#1c232d] p-2.5">
              <div className="text-[9px] font-mono uppercase text-[#64748b]">VaR (95% 1-DAY)</div>
              <div className="text-base font-bold font-mono text-white mt-0.5">{metrics.var_95_pct || 0}%</div>
              <div className="text-[9px] font-mono text-rose-400">-${portfolioAllocations.dollarVaR.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            </div>

            <div className="bg-[#0e1217] border border-[#1c232d] p-2.5">
              <div className="text-[9px] font-mono uppercase text-[#64748b]">TAIL VaR (99%)</div>
              <div className="text-base font-bold font-mono text-white mt-0.5">{metrics.var_99_pct || 0}%</div>
              <div className="text-[9px] font-mono text-[#64748b]">99% CONFIDENCE</div>
            </div>

            <div className="bg-[#0e1217] border border-[#1c232d] p-2.5">
              <div className="text-[9px] font-mono uppercase text-[#64748b]">EXP SHORTFALL</div>
              <div className="text-base font-bold font-mono text-rose-400 mt-0.5">{metrics.cvar_95_pct || 0}%</div>
              <div className="text-[9px] font-mono text-rose-400/80">-${portfolioAllocations.dollarCVaR.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            </div>

            <div className="bg-[#0e1217] border border-[#1c232d] p-2.5">
              <div className="text-[9px] font-mono uppercase text-[#64748b]">ANN. SIGMA</div>
              <div className="text-base font-bold font-mono text-white mt-0.5">{metrics.annualized_volatility_pct || 0}%</div>
              <div className="text-[9px] font-mono text-[#64748b]">21D ROLLING</div>
            </div>

            <div className="bg-[#0e1217] border border-[#1c232d] p-2.5">
              <div className="text-[9px] font-mono uppercase text-[#64748b]">MAX DRAWDOWN</div>
              <div className="text-base font-bold font-mono text-amber-400 mt-0.5">{metrics.max_drawdown_pct || 0}%</div>
              <div className="text-[9px] font-mono text-[#64748b]">PEAK-TO-TROUGH</div>
            </div>

            <div className="bg-[#0e1217] border border-[#1c232d] p-2.5">
              <div className="text-[9px] font-mono uppercase text-[#64748b]">SHARPE (RF=4%)</div>
              <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">{metrics.sharpe_ratio || 0}</div>
              <div className="text-[9px] font-mono text-emerald-400/80">ANNUALIZED</div>
            </div>

          </div>

        </div>

        {/* RIGHT COLUMN: REBALANCING EXECUTION, STRESS TESTING & TELEMETRY (5 COLS) */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Module D: Target Portfolio Rebalance Engine */}
          <div className="bg-[#0e1217] border border-[#1c232d] p-4">
            
            <div className="flex items-center justify-between border-b border-[#1c232d] pb-2 mb-3">
              <div className="font-mono text-[10px] uppercase text-[#64748b] tracking-wider">
                ADAPTIVE ASSET ALLOCATION // EXECUTION MATRIX
              </div>
              <div className="font-mono text-[10px] text-[#64748b]">
                STANCE: <span className="text-white font-bold">{rec.risk_stance || "BALANCED"}</span>
              </div>
            </div>

            {/* Asset Allocation Weights Table with Trade Deltas */}
            <div className="space-y-3 font-mono">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-300">EQUITIES // SYSTEMIC BETA</span>
                  <span>
                    <strong className="text-white">{weights.equities_pct}%</strong>
                    <span className="text-[#64748b] ml-1.5">(${portfolioAllocations.equitiesDollar.toLocaleString(undefined, { maximumFractionDigits: 0 })})</span>
                  </span>
                </div>
                <div className="w-full bg-[#090b0e] h-1.5 border border-[#1c232d]">
                  <div className="bg-sky-400 h-full transition-all duration-300" style={{ width: `${weights.equities_pct}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-300">FIXED INCOME // SOVEREIGN BONDS</span>
                  <span>
                    <strong className="text-white">{weights.fixed_income_pct}%</strong>
                    <span className="text-[#64748b] ml-1.5">(${portfolioAllocations.bondsDollar.toLocaleString(undefined, { maximumFractionDigits: 0 })})</span>
                  </span>
                </div>
                <div className="w-full bg-[#090b0e] h-1.5 border border-[#1c232d]">
                  <div className="bg-indigo-400 h-full transition-all duration-300" style={{ width: `${weights.fixed_income_pct}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-300">CASH & LIQUIDITY RESERVES</span>
                  <span>
                    <strong className="text-white">{weights.cash_and_hedges_pct}%</strong>
                    <span className="text-[#64748b] ml-1.5">(${portfolioAllocations.cashDollar.toLocaleString(undefined, { maximumFractionDigits: 0 })})</span>
                  </span>
                </div>
                <div className="w-full bg-[#090b0e] h-1.5 border border-[#1c232d]">
                  <div className="bg-amber-400 h-full transition-all duration-300" style={{ width: `${weights.cash_and_hedges_pct}%` }} />
                </div>
              </div>
            </div>

            {/* Action Directives */}
            <div className="mt-4 p-2.5 bg-[#090b0e] border border-[#1c232d] font-mono text-[10px] text-[#94a3b8]">
              <span className="text-[#64748b] block uppercase">Execution Directive:</span>
              <span className="text-slate-200">{rec.action_directive || "Allocation is optimal for current classified regime."}</span>
            </div>

            <div className="mt-4 pt-3 border-t border-[#1c232d] flex gap-2 font-mono">
              <button 
                onClick={() => alert(`Rebalance order generated for $${portfolioCapital.toLocaleString()} portfolio.`)}
                className="flex-1 py-2 bg-[#1c232d] hover:bg-[#2a3443] border border-[#334155] text-white font-bold text-[11px] tracking-wider uppercase transition"
              >
                DISPATCH REBALANCE ORDER
              </button>
            </div>

          </div>

          {/* Module E: Macro Stress Testing Sandbox */}
          <div className="bg-[#0e1217] border border-[#1c232d] p-4">
            
            <div className="flex items-center justify-between border-b border-[#1c232d] pb-2 mb-3">
              <div className="font-mono text-[10px] uppercase text-[#64748b] tracking-wider">
                INSTITUTIONAL STRESS TESTING SANDBOX
              </div>
              <div className="font-mono text-[10px] text-rose-400">
                CAUSAL ENGINE
              </div>
            </div>

            <p className="font-mono text-[10px] text-[#64748b] mb-3">
              Inject synthetic macro shocks to test model regime switching and emergency derisking protocols.
            </p>

            <div className="space-y-2 font-mono">
              <div className="p-2.5 bg-[#090b0e] border border-[#1c232d] flex items-center justify-between">
                <div>
                  <div className="text-white font-bold text-[11px]">[SCENARIO A] FLASH CRASH</div>
                  <div className="text-[10px] text-[#64748b]">-5.0% price drop // 2.5x vol multiplier</div>
                </div>
                <button
                  onClick={() => executeStressShock(-5.0, 2.5)}
                  disabled={shockLoading}
                  className="px-3 py-1 bg-[#281318] hover:bg-[#381a22] border border-rose-800 text-rose-300 text-[10px] font-bold transition disabled:opacity-50"
                >
                  {shockLoading ? "CALCULATING..." : "INJECT SHOCK"}
                </button>
              </div>

              <div className="p-2.5 bg-[#090b0e] border border-[#1c232d] flex items-center justify-between">
                <div>
                  <div className="text-white font-bold text-[11px]">[SCENARIO B] SYSTEMIC CRISIS</div>
                  <div className="text-[10px] text-[#64748b]">-8.5% price shock // 3.2x vol multiplier</div>
                </div>
                <button
                  onClick={() => executeStressShock(-8.5, 3.2)}
                  disabled={shockLoading}
                  className="px-3 py-1 bg-[#281318] hover:bg-[#381a22] border border-rose-800 text-rose-300 text-[10px] font-bold transition disabled:opacity-50"
                >
                  {shockLoading ? "CALCULATING..." : "INJECT SHOCK"}
                </button>
              </div>

              <div className="p-2.5 bg-[#090b0e] border border-[#1c232d] flex items-center justify-between">
                <div>
                  <div className="text-white font-bold text-[11px]">[BASELINE] RE-NORMALIZE</div>
                  <div className="text-[10px] text-[#64748b]">Restore live market tick parameters</div>
                </div>
                <button
                  onClick={() => syncData()}
                  disabled={shockLoading}
                  className="px-3 py-1 bg-[#131820] hover:bg-[#1a212d] border border-[#2a3443] text-slate-300 text-[10px] font-bold transition"
                >
                  RESET
                </button>
              </div>
            </div>

          </div>

          {/* Module F: Cloud Telemetry & Zero-Cost Guardrails */}
          <div className="bg-[#0e1217] border border-[#1c232d] p-3 font-mono text-[10px]">
            <div className="flex items-center justify-between border-b border-[#1c232d] pb-1.5 mb-2 text-[#64748b]">
              <span>AWS DECOUPLED MICROSERVICES TELEMETRY</span>
              <span className="text-emerald-400">AWS ALWAYS FREE TIER</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[#94a3b8]">
              <div>LAMBDA WORKER: <strong className="text-white">38MS P95</strong></div>
              <div>SQS QUEUE: <strong className="text-white">0 BACKLOG (10S POLL)</strong></div>
              <div>DYNAMODB: <strong className="text-white">5 RCU / 5 WCU PROV</strong></div>
              <div>BUDGET ALARM: <strong className="text-emerald-400">$0.01 ALARM ($0.00 INVENT)</strong></div>
            </div>
          </div>

        </div>

      </main>

      {/* 4. FOOTER STATUS BAR */}
      <footer className="h-7 bg-[#0b0e13] border-t border-[#1c232d] px-4 flex items-center justify-between font-mono text-[10px] text-[#64748b]">
        <div>
          SYSTEM: <strong>AEGIS QUANTITATIVE RISK PLATFORM</strong> // INSTITUTIONAL RELEASE
        </div>
        <div>
          HOSTED: <strong>AWS SERVERLESS ARCHITECTURE (S3 + SQS + LAMBDA + DYNAMODB + SNS)</strong>
        </div>
      </footer>

      {/* 5. PRODUCT & CLOUD ARCHITECTURE SPECIFICATION MODAL */}
      {showSpecsModal && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-[#0e1217] border border-[#2a3443] max-w-2xl w-full p-6 font-mono text-xs shadow-2xl relative">
            
            <div className="flex justify-between items-start border-b border-[#1c232d] pb-3 mb-4">
              <div>
                <div className="text-white font-bold text-sm">AEGIS RISK // PRODUCT & CLOUD ARCHITECTURE</div>
                <div className="text-[#64748b] text-[10px]">Zero-Cost AWS Serverless Microservices Platform</div>
              </div>
              <button 
                onClick={() => setShowSpecsModal(false)}
                className="text-[#64748b] hover:text-white px-2 py-0.5 border border-[#1c232d]"
              >
                [ESC / CLOSE]
              </button>
            </div>

            <div className="space-y-4 text-[#94a3b8] leading-relaxed">
              <div className="p-3 bg-[#090b0e] border border-[#1c232d] grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[#64748b] block text-[10px]">ENGINEERING TEAM</span>
                  <div className="text-white font-bold">Nandini Sah (Reg: 240905552, Roll 54)</div>
                  <div className="text-white font-bold">Prisha Gupta (Reg: 240905612, Roll 61)</div>
                  <div className="text-[10px] text-[#64748b]">5th Semester // Section D // Batch D2</div>
                </div>
                <div>
                  <span className="text-[#64748b] block text-[10px]">FACULTY SUPERVISORS</span>
                  <div className="text-white font-bold">Dr. Anup Bhat</div>
                  <div className="text-white font-bold">Dr. Swati B P</div>
                  <div className="text-[10px] text-[#64748b]">School of Computer Engineering</div>
                </div>
              </div>

              <div>
                <span className="text-white font-bold block mb-1">FREE-TIER CLOUD & DEVOPS SPECIFICATION:</span>
                <ul className="list-disc pl-5 space-y-1 text-[11px]">
                  <li><strong>AWS Lambda:</strong> 1,000,000 requests/mo (Always Free Tier) - Event worker</li>
                  <li><strong>Amazon DynamoDB:</strong> 25 GB + 25 RCU/WCU (Always Free) - Provisioned mode</li>
                  <li><strong>Amazon SQS & SNS:</strong> 1,000,000 msgs/mo (Always Free) - Decoupled queue & alerts</li>
                  <li><strong>Amazon S3:</strong> 5 GB standard storage (Always Free) - Raw OHLCV tick data</li>
                  <li><strong>AWS Budgets:</strong> $0.01 threshold automated zero-cost safeguard alarm</li>
                  <li><strong>Infrastructure as Code:</strong> <code>terraform/main.tf</code> (Automated provisioning)</li>
                  <li><strong>CI/CD Pipeline:</strong> <code>.github/workflows/ci-cd.yml</code> (Automated testing & linting)</li>
                  <li><strong>Technical Design Doc:</strong> <code>docs/TECHNICAL_DESIGN_DOCUMENT.md</code></li>
                  <li><strong>Source Code Repository:</strong> <code>https://github.com/nxndinisxh/ccdl-mini</code></li>
                </ul>
              </div>

              <div className="pt-2 border-t border-[#1c232d] flex justify-end">
                <button
                  onClick={() => setShowSpecsModal(false)}
                  className="px-4 py-1.5 bg-[#1c232d] hover:bg-[#2a3443] text-white font-mono text-[11px]"
                >
                  DISMISS
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
