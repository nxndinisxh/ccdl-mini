/**
 * Frontend Application Controller for Market Regime & Adaptive Risk Engine.
 */

// Color mapping for regimes
const REGIME_COLORS = {
  "Low-Volatility Bullish": "#10b981", // Emerald
  "High-Volatility Bullish": "#06b6d4", // Cyan
  "Sideways / Neutral": "#94a3b8",      // Slate
  "High-Volatility Bearish": "#f43f5e", // Rose
};

const REGIME_BG_CLASSES = {
  "Low-Volatility Bullish": "bg-emerald-950 text-emerald-400 border-emerald-800",
  "High-Volatility Bullish": "bg-cyan-950 text-cyan-400 border-cyan-800",
  "Sideways / Neutral": "bg-slate-800 text-slate-300 border-slate-700",
  "High-Volatility Bearish": "bg-rose-950 text-rose-400 border-rose-800",
};

const RISK_TIER_CLASSES = {
  "LOW": "bg-emerald-900 text-emerald-300",
  "MODERATE": "bg-amber-900 text-amber-300",
  "ELEVATED": "bg-orange-900 text-orange-300",
  "CRITICAL": "bg-rose-900 text-rose-300 animate-pulse",
};

// State
let currentTicker = "^GSPC";
let historicalData = [];

// DOM Elements
const tickerSelect = document.getElementById("tickerSelect");
const refreshBtn = document.getElementById("refreshBtn");
const shockBtn = document.getElementById("shockBtn");
const regimeBadge = document.getElementById("regimeBadge");
const latestPrice = document.getElementById("latestPrice");
const regimeDesc = document.getElementById("regimeDescription");
const alertBanner = document.getElementById("alertBanner");
const riskScoreVal = document.getElementById("riskScoreVal");
const riskTier = document.getElementById("riskTier");
const riskGaugeBar = document.getElementById("riskGaugeBar");
const riskStance = document.getElementById("riskStance");
const var95Preview = document.getElementById("var95Preview");

// Metrics
const metricVaR95 = document.getElementById("metricVaR95");
const metricVaR99 = document.getElementById("metricVaR99");
const metricCVaR = document.getElementById("metricCVaR");
const metricVol = document.getElementById("metricVol");
const metricMDD = document.getElementById("metricMDD");
const metricSharpe = document.getElementById("metricSharpe");

// Allocations
const allocEquities = document.getElementById("allocEquities");
const allocBonds = document.getElementById("allocBonds");
const allocCash = document.getElementById("allocCash");
const barEquities = document.getElementById("barEquities");
const barBonds = document.getElementById("barBonds");
const barCash = document.getElementById("barCash");
const actionDirective = document.getElementById("actionDirective");
const centroidTableBody = document.getElementById("centroidTableBody");
const timelineCanvas = document.getElementById("timelineChart");

/**
 * Fetch and update active regime and risk metrics
 */
async function loadCurrentRegime(ticker) {
  try {
    const res = await fetch(`/api/regime/current?ticker=${encodeURIComponent(ticker)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderCurrentState(data);
  } catch (err) {
    console.error("Failed to load current regime:", err);
  }
}

/**
 * Fetch and plot historical timeline
 */
async function loadHistoricalData(ticker) {
  try {
    const res = await fetch(`/api/regime/history?ticker=${encodeURIComponent(ticker)}&limit=180`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    historicalData = data.history || [];
    renderCentroidTable(data.cluster_summaries || []);
    drawTimelineChart(historicalData);
  } catch (err) {
    console.error("Failed to load history:", err);
  }
}

/**
 * Update UI with analytical results
 */
function renderCurrentState(data) {
  const regime = data.regime || "Low-Volatility Bullish";
  const metrics = data.metrics || {};
  const rec = data.recommendation || {};
  const weights = rec.target_weights || { equities_pct: 80, fixed_income_pct: 15, cash_and_hedges_pct: 5 };

  // Regime Badge
  regimeBadge.textContent = regime;
  regimeBadge.className = `mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-lg font-bold border transition ${REGIME_BG_CLASSES[regime] || REGIME_BG_CLASSES["Sideways / Neutral"]}`;

  // Price
  latestPrice.textContent = `$${Number(data.current_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Description
  const descriptions = {
    "Low-Volatility Bullish": "Persistent upward market trend accompanied by subdued volatility. Favorable macroeconomic environment for broad equity exposure.",
    "High-Volatility Bullish": "Strong upward momentum but with elevated dispersion and volatility spikes. Caution advised against sudden pullbacks.",
    "Sideways / Neutral": "Mean-reverting consolidation phase with lack of decisive directional trend. Balanced, range-trading approach suggested.",
    "High-Volatility Bearish": "Severe downward price pressure combined with elevated volatility and heightened tail risk. Capital preservation is priority.",
  };
  regimeDesc.textContent = descriptions[regime] || "Market condition evaluated by unsupervised clustering model.";

  // Alert Banner
  if (regime === "High-Volatility Bearish" || data.risk_score >= 75) {
    alertBanner.classList.remove("hidden");
  } else {
    alertBanner.classList.add("hidden");
  }

  // Risk Score
  const score = data.risk_score || 0;
  riskScoreVal.textContent = score.toFixed(1);
  riskTier.textContent = data.risk_tier || "LOW";
  riskTier.className = `px-2 py-0.5 rounded text-xs font-bold ${RISK_TIER_CLASSES[data.risk_tier] || RISK_TIER_CLASSES["LOW"]}`;
  riskGaugeBar.style.width = `${Math.min(100, Math.max(5, score))}%`;

  riskStance.textContent = rec.risk_stance || "Aggressive Growth";
  var95Preview.textContent = `${metrics.var_95_pct || 0}%`;

  // Metric cards
  metricVaR95.textContent = `${metrics.var_95_pct || 0}%`;
  metricVaR99.textContent = `${metrics.var_99_pct || 0}%`;
  metricCVaR.textContent = `${metrics.cvar_95_pct || 0}%`;
  metricVol.textContent = `${metrics.annualized_volatility_pct || 0}%`;
  metricMDD.textContent = `${metrics.max_drawdown_pct || 0}%`;
  metricSharpe.textContent = `${metrics.sharpe_ratio || 0}`;

  // Allocation
  allocEquities.textContent = `${weights.equities_pct}%`;
  allocBonds.textContent = `${weights.fixed_income_pct}%`;
  allocCash.textContent = `${weights.cash_and_hedges_pct}%`;
  barEquities.style.width = `${weights.equities_pct}%`;
  barBonds.style.width = `${weights.fixed_income_pct}%`;
  barCash.style.width = `${weights.cash_and_hedges_pct}%`;

  actionDirective.textContent = rec.action_directive || "Allocation optimized by adaptive risk engine.";
}

/**
 * Render Cluster Centroid Table
 */
function renderCentroidTable(summaries) {
  centroidTableBody.innerHTML = "";
  summaries.forEach((c) => {
    const tr = document.createElement("tr");
    const color = REGIME_COLORS[c.regime] || "#94a3b8";
    tr.innerHTML = `
      <td class="font-medium text-slate-200 flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full inline-block" style="background-color: ${color}"></span>
        ${c.regime}
      </td>
      <td class="text-slate-300">${c.mean_daily_return_pct.toFixed(2)}%</td>
      <td class="text-slate-300">${(c.mean_annualized_volatility * 100).toFixed(1)}%</td>
      <td class="text-slate-300">${c.mean_trend_deviation_pct.toFixed(2)}%</td>
      <td class="text-slate-300">${c.mean_rsi.toFixed(1)}</td>
    `;
    centroidTableBody.appendChild(tr);
  });
}

/**
 * Draw interactive HTML5 Canvas Timeline Chart
 */
function drawTimelineChart(items) {
  if (!items || items.length === 0) return;
  const ctx = timelineCanvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const rect = timelineCanvas.getBoundingClientRect();

  timelineCanvas.width = rect.width * dpr;
  timelineCanvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;
  const padLeft = 50;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 30;

  ctx.clearRect(0, 0, w, h);

  const prices = items.map((d) => d.close);
  const minP = Math.min(...prices) * 0.98;
  const maxP = Math.max(...prices) * 1.02;

  const chartW = w - padLeft - padRight;
  const chartH = h - padTop - padBottom;

  // Draw Horizontal Gridlines & Price Labels
  ctx.strokeStyle = "#1e293b";
  ctx.fillStyle = "#64748b";
  ctx.font = "10px monospace";
  ctx.textAlign = "right";

  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const yVal = minP + (i / gridSteps) * (maxP - minP);
    const yPx = padTop + chartH - (i / gridSteps) * chartH;
    ctx.beginPath();
    ctx.moveTo(padLeft, yPx);
    ctx.lineTo(w - padRight, yPx);
    ctx.stroke();
    ctx.fillText(`$${yVal.toFixed(0)}`, padLeft - 6, yPx + 3);
  }

  // Draw Line Segments with Regime Colors
  for (let i = 0; i < items.length - 1; i++) {
    const p1 = items[i];
    const p2 = items[i + 1];

    const x1 = padLeft + (i / (items.length - 1)) * chartW;
    const y1 = padTop + chartH - ((p1.close - minP) / (maxP - minP)) * chartH;

    const x2 = padLeft + ((i + 1) / (items.length - 1)) * chartW;
    const y2 = padTop + chartH - ((p2.close - minP) / (maxP - minP)) * chartH;

    const color = REGIME_COLORS[p2.regime] || "#94a3b8";

    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Draw Date labels at start, mid, end
  ctx.fillStyle = "#64748b";
  ctx.textAlign = "center";
  const startDt = items[0].date;
  const midDt = items[Math.floor(items.length / 2)].date;
  const endDt = items[items.length - 1].date;

  ctx.fillText(startDt, padLeft + 20, h - 8);
  ctx.fillText(midDt, padLeft + chartW / 2, h - 8);
  ctx.fillText(endDt, w - padRight - 20, h - 8);
}

// Event Listeners
tickerSelect.addEventListener("change", (e) => {
  currentTicker = e.target.value;
  loadCurrentRegime(currentTicker);
  loadHistoricalData(currentTicker);
});

refreshBtn.addEventListener("click", () => {
  loadCurrentRegime(currentTicker);
  loadHistoricalData(currentTicker);
});

shockBtn.addEventListener("click", async () => {
  shockBtn.disabled = true;
  shockBtn.innerHTML = `Simulating Crash...`;
  try {
    const res = await fetch("/api/simulate-shock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker: currentTicker, drop_pct: -5.5, volatility_mult: 2.8 }),
    });
    if (!res.ok) throw new Error("Shock simulation failed");
    const data = await res.json();

    // Map shock response to render structure
    renderCurrentState({
      regime: data.resulting_regime,
      current_price: (historicalData[historicalData.length - 1]?.close || 5000) * 0.945,
      risk_score: data.risk_score,
      risk_tier: data.risk_tier,
      metrics: data.metrics,
      recommendation: data.adaptive_recommendation,
    });

    // Refresh history
    await loadHistoricalData(currentTicker);
  } catch (err) {
    console.error(err);
  } finally {
    shockBtn.disabled = false;
    shockBtn.innerHTML = `
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"></path></svg>
      Simulate Shock (-5% Stress Test)
    `;
  }
});

// Window resize handler for responsive canvas
window.addEventListener("resize", () => {
  drawTimelineChart(historicalData);
});

// Initial boot
loadCurrentRegime(currentTicker);
loadHistoricalData(currentTicker);
