(() => {
"use strict";

const API_KEY = (typeof CONFIG !== "undefined" && CONFIG.COINGECKO_API_KEY) ? CONFIG.COINGECKO_API_KEY : "";
const BASE = "https://api.coingecko.com/api/v3";
const HEADERS = API_KEY ? { "x-cg-demo-api-key": API_KEY } : {};

let state = {
  currency: "usd",
  page: 1,
  perPage: 50,
  coins: [],
  trending: [],
  chartData: null,
  modalCoinId: null,
  chartDays: 7,
};

const SYMBOLS = { usd: "$", idr: "Rp", eur: "€", jpy: "¥", gbp: "£" };
const fmt = (n, cur) => {
  if (n == null) return "—";
  const s = SYMBOLS[cur || state.currency] || "$";
  if (Math.abs(n) >= 1e12) return s + (n / 1e12).toFixed(2) + "T";
  if (Math.abs(n) >= 1e9) return s + (n / 1e9).toFixed(2) + "B";
  if (Math.abs(n) >= 1e6) return s + (n / 1e6).toFixed(2) + "M";
  if (Math.abs(n) >= 1e3) return s + n.toLocaleString("en", { maximumFractionDigits: 2 });
  if (Math.abs(n) >= 1) return s + n.toFixed(2);
  return s + n.toPrecision(4);
};
const pct = (n) => {
  if (n == null) return "—";
  const sign = n >= 0 ? "+" : "";
  return sign + n.toFixed(2) + "%";
};
const $  = (id) => document.getElementById(id);
const qs = (sel, el) => (el || document).querySelector(sel);
const qsa = (sel, el) => (el || document).querySelectorAll(sel);

async function api(path, params = {}) {
  const url = new URL(BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

async function loadGlobal() {
  try {
    const d = await api("/global");
    const g = d.data;
    $("global-market-cap").textContent = fmt(g.total_market_cap[state.currency]);
    const mcChange = g.market_cap_change_percentage_24h_usd;
    const mcEl = $("global-market-cap-change");
    mcEl.textContent = pct(mcChange);
    mcEl.className = "stat-change " + (mcChange >= 0 ? "positive" : "negative");
    $("global-volume").textContent = fmt(g.total_volume[state.currency]);
    $("global-volume-info").textContent = "from " + g.active_cryptocurrencies.toLocaleString() + " coins";
    $("global-btc-dom").textContent = g.market_cap_percentage.btc.toFixed(1) + "%";
    $("global-coins").textContent = g.active_cryptocurrencies.toLocaleString();
    $("global-exchanges").textContent = g.markets + " active exchanges";
  } catch (e) {
    console.error("Global stats error:", e);
  }
}

function showSkeletons() {
  const tbody = $("coin-table-body");
  let html = "";
  for (let i = 0; i < state.perPage; i++) {
    html += `<tr class="skeleton-row">
      <td class="td-rank"><div class="skeleton w-sm"></div></td>
      <td class="td-name"><div style="display:flex;align-items:center;gap:12px"><div class="skeleton circle"></div><div><div class="skeleton w-lg" style="margin-bottom:4px"></div><div class="skeleton w-sm"></div></div></div></td>
      <td><div class="skeleton w-md" style="margin-left:auto"></div></td>
      <td><div class="skeleton w-sm" style="margin-left:auto"></div></td>
      <td><div class="skeleton w-sm" style="margin-left:auto"></div></td>
      <td><div class="skeleton w-sm" style="margin-left:auto"></div></td>
      <td><div class="skeleton w-lg" style="margin-left:auto"></div></td>
      <td><div class="skeleton w-xl" style="margin-left:auto"></div></td>
      <td><div class="skeleton" style="width:100px;height:32px;margin-left:auto"></div></td>
    </tr>`;
  }
  tbody.innerHTML = html;
}

async function loadCoins() {
  showSkeletons();
  try {
    const data = await api("/coins/markets", {
      vs_currency: state.currency,
      order: "market_cap_desc",
      per_page: state.perPage,
      page: state.page,
      sparkline: "true",
      price_change_percentage: "1h,24h,7d",
    });
    state.coins = data;
    renderCoins();
    updatePagination();
  } catch (e) {
    console.error("Coins error:", e);
    $("coin-table-body").innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-muted)">Failed to load data. Please try again later.</td></tr>`;
  }
}

function renderCoins() {
  const tbody = $("coin-table-body");
  if (!state.coins.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-muted)">No data available</td></tr>`;
    return;
  }
  tbody.innerHTML = state.coins.map((c) => {
    const ch1h = c.price_change_percentage_1h_in_currency;
    const ch24h = c.price_change_percentage_24h;
    const ch7d = c.price_change_percentage_7d_in_currency;
    return `<tr data-id="${c.id}">
      <td class="td-rank">${c.market_cap_rank || "—"}</td>
      <td class="td-name"><div class="coin-name-cell"><img src="${c.image}" alt="${c.name}" loading="lazy"><div class="coin-info"><span class="coin-name">${c.name}</span><span class="coin-symbol">${c.symbol}</span></div></div></td>
      <td class="td-price">${fmt(c.current_price)}</td>
      <td class="td-change ${ch1h >= 0 ? "positive" : "negative"}">${pct(ch1h)}</td>
      <td class="td-change ${ch24h >= 0 ? "positive" : "negative"}">${pct(ch24h)}</td>
      <td class="td-change ${ch7d >= 0 ? "positive" : "negative"}">${pct(ch7d)}</td>
      <td class="td-volume">${fmt(c.total_volume)}</td>
      <td class="td-mcap">${fmt(c.market_cap)}</td>
      <td class="td-sparkline"><canvas id="spark-${c.id}" width="120" height="36"></canvas></td>
    </tr>`;
  }).join("");

  state.coins.forEach((c) => {
    if (c.sparkline_in_7d && c.sparkline_in_7d.price) {
      drawSparkline($("spark-" + c.id), c.sparkline_in_7d.price);
    }
  });
}

function drawSparkline(canvas, prices) {
  if (!canvas || !prices || !prices.length) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  ctx.scale(dpr, dpr);

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const step = w / (prices.length - 1);
  const isUp = prices[prices.length - 1] >= prices[0];

  ctx.beginPath();
  prices.forEach((p, i) => {
    const x = i * step;
    const y = h - ((p - min) / range) * (h - 4) - 2;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = isUp ? "#10b981" : "#ef4444";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, isUp ? "rgba(16,185,129,.15)" : "rgba(239,68,68,.15)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
}

function updatePagination() {
  $("page-info").textContent = "Page " + state.page;
  $("prev-page").disabled = state.page <= 1;
  $("next-page").disabled = state.coins.length < state.perPage;
}

async function loadTrending() {
  try {
    const d = await api("/search/trending");
    state.trending = d.coins || [];
    renderTrending();
  } catch (e) {
    console.error("Trending error:", e);
  }
}

function renderTrending() {
  const el = $("trending-list");
  if (!state.trending.length) {
    el.innerHTML = '<div style="padding:20px;color:var(--text-muted);text-align:center;font-size:.85rem">No data available</div>';
    return;
  }
  el.innerHTML = state.trending.slice(0, 7).map((t) => {
    const c = t.item;
    return `<div class="trending-item" data-id="${c.id}">
      <img src="${c.small}" alt="${c.name}" loading="lazy">
      <div class="trending-item-info">
        <div class="trending-item-name">${c.name}</div>
        <div class="trending-item-symbol">${c.symbol}</div>
      </div>
      <span class="trending-item-rank">#${c.market_cap_rank || c.score + 1}</span>
    </div>`;
  }).join("");
}

function renderGainersLosers() {
  if (!state.coins.length) return;
  const sorted = [...state.coins].filter(c => c.price_change_percentage_24h != null);
  sorted.sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);

  const gainers = sorted.slice(0, 5);
  const losers = sorted.slice(-5).reverse();

  $("gainers-list").innerHTML = gainers.map(c => `
    <div class="gainer-item" data-id="${c.id}">
      <img src="${c.image}" alt="${c.name}" loading="lazy">
      <div class="gainer-item-info">
        <div class="gainer-item-name">${c.name}</div>
        <div class="gainer-item-symbol">${c.symbol}</div>
      </div>
      <span class="gainer-item-change positive">${pct(c.price_change_percentage_24h)}</span>
    </div>
  `).join("");

  $("losers-list").innerHTML = losers.map(c => `
    <div class="gainer-item" data-id="${c.id}">
      <img src="${c.image}" alt="${c.name}" loading="lazy">
      <div class="gainer-item-info">
        <div class="gainer-item-name">${c.name}</div>
        <div class="gainer-item-symbol">${c.symbol}</div>
      </div>
      <span class="gainer-item-change negative">${pct(c.price_change_percentage_24h)}</span>
    </div>
  `).join("");
}

let searchTimeout;
const searchInput = $("search-input");
const searchResults = $("search-results");
const searchResultsInner = $("search-results-inner");

searchInput.addEventListener("input", () => {
  clearTimeout(searchTimeout);
  const q = searchInput.value.trim();
  if (q.length < 2) { searchResults.classList.remove("active"); return; }
  searchTimeout = setTimeout(async () => {
    try {
      const d = await api("/search", { query: q });
      const coins = d.coins || [];
      if (!coins.length) {
        searchResultsInner.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">No results found</div>';
      } else {
        searchResultsInner.innerHTML = coins.slice(0, 8).map(c => `
          <div class="search-result-item" data-id="${c.id}">
            <img src="${c.thumb}" alt="${c.name}">
            <span class="search-result-name">${c.name}</span>
            <span class="search-result-symbol">${c.symbol}</span>
            ${c.market_cap_rank ? `<span class="search-result-rank">#${c.market_cap_rank}</span>` : ""}
          </div>
        `).join("");
      }
      searchResults.classList.add("active");
    } catch (e) {
      console.error("Search error:", e);
    }
  }, 350);
});

searchResultsInner.addEventListener("click", (e) => {
  const item = e.target.closest(".search-result-item");
  if (item) {
    openModal(item.dataset.id);
    searchResults.classList.remove("active");
    searchInput.value = "";
  }
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-wrapper")) searchResults.classList.remove("active");
});

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "k") {
    e.preventDefault();
    searchInput.focus();
  }
  if (e.key === "Escape") {
    searchResults.classList.remove("active");
    closeModal();
  }
});

async function openModal(coinId) {
  state.modalCoinId = coinId;
  state.chartDays = 7;
  const overlay = $("modal-overlay");
  const content = $("modal-content");
  overlay.classList.add("active");
  document.body.style.overflow = "hidden";
  content.innerHTML = '<div class="modal-loading"><div class="spinner"></div><p>Loading data...</p></div>';

  try {
    const [coin, chart] = await Promise.all([
      api("/coins/" + coinId, { localization: "false", tickers: "false", community_data: "false", developer_data: "false" }),
      api("/coins/" + coinId + "/market_chart", { vs_currency: state.currency, days: state.chartDays }),
    ]);
    state.chartData = chart;
    renderModal(coin, chart);
  } catch (e) {
    console.error("Modal error:", e);
    content.innerHTML = '<div class="modal-loading"><p style="color:var(--red)">Failed to load coin data.</p></div>';
  }
}

function renderModal(coin, chart) {
  const md = coin.market_data;
  const price = md?.current_price?.[state.currency];
  const ch24 = md?.price_change_percentage_24h;
  const desc = coin.description?.en || "";
  const shortDesc = desc.replace(/<[^>]*>/g, "").slice(0, 400);

  const content = $("modal-content");
  content.innerHTML = `
    <div class="modal-header">
      <img src="${coin.image?.large || ''}" alt="${coin.name}">
      <div class="modal-header-info">
        <h2>${coin.name}</h2>
        <span>${coin.symbol?.toUpperCase()} · Rank #${md?.market_cap_rank || '—'}</span>
      </div>
      <button class="modal-close" id="modal-close">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="modal-price">${fmt(price)}</div>
    <div class="modal-price-change ${ch24 >= 0 ? "positive" : "negative"}">${pct(ch24)} (24h)</div>
    <div class="modal-chart-container">
      <div class="chart-timeframe-btns">
        <button class="chart-tf-btn" data-days="1">24H</button>
        <button class="chart-tf-btn active" data-days="7">7D</button>
        <button class="chart-tf-btn" data-days="30">30D</button>
        <button class="chart-tf-btn" data-days="90">90D</button>
        <button class="chart-tf-btn" data-days="365">1Y</button>
      </div>
      <canvas id="modal-chart" width="660" height="250"></canvas>
    </div>
    <div class="modal-stats-grid">
      <div class="modal-stat"><div class="modal-stat-label">Market Cap</div><div class="modal-stat-value">${fmt(md?.market_cap?.[state.currency])}</div></div>
      <div class="modal-stat"><div class="modal-stat-label">Volume 24h</div><div class="modal-stat-value">${fmt(md?.total_volume?.[state.currency])}</div></div>
      <div class="modal-stat"><div class="modal-stat-label">24h High</div><div class="modal-stat-value">${fmt(md?.high_24h?.[state.currency])}</div></div>
      <div class="modal-stat"><div class="modal-stat-label">24h Low</div><div class="modal-stat-value">${fmt(md?.low_24h?.[state.currency])}</div></div>
      <div class="modal-stat"><div class="modal-stat-label">ATH</div><div class="modal-stat-value">${fmt(md?.ath?.[state.currency])}</div></div>
      <div class="modal-stat"><div class="modal-stat-label">ATL</div><div class="modal-stat-value">${fmt(md?.atl?.[state.currency])}</div></div>
      <div class="modal-stat"><div class="modal-stat-label">Circulating Supply</div><div class="modal-stat-value">${md?.circulating_supply ? md.circulating_supply.toLocaleString("en", { maximumFractionDigits: 0 }) : "—"}</div></div>
      <div class="modal-stat"><div class="modal-stat-label">Max Supply</div><div class="modal-stat-value">${md?.max_supply ? md.max_supply.toLocaleString("en", { maximumFractionDigits: 0 }) : "∞"}</div></div>
    </div>
    ${shortDesc ? `<div class="modal-desc"><h3>About ${coin.name}</h3><p>${shortDesc}${desc.length > 400 ? "..." : ""}</p></div>` : ""}
  `;

  drawModalChart(chart.prices);
  attachChartTimeframeBtns();
}

function drawModalChart(prices) {
  const canvas = $("modal-chart");
  if (!canvas || !prices || !prices.length) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.parentElement.clientWidth - 32;
  const h = 250;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const vals = prices.map(p => p[1]);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const step = w / (vals.length - 1);
  const isUp = vals[vals.length - 1] >= vals[0];
  const color = isUp ? "#10b981" : "#ef4444";

  ctx.strokeStyle = "rgba(255,255,255,.04)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = (h / 4) * i;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  ctx.fillStyle = "rgba(255,255,255,.25)";
  ctx.font = "10px 'JetBrains Mono'";
  ctx.textAlign = "right";
  for (let i = 0; i <= 4; i++) {
    const val = max - (range / 4) * i;
    const y = (h / 4) * i;
    ctx.fillText(fmt(val), w - 4, y + 12);
  }

  ctx.beginPath();
  vals.forEach((v, i) => {
    const x = i * step;
    const y = h - ((v - min) / range) * (h - 20) - 10;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.stroke();

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, isUp ? "rgba(16,185,129,.2)" : "rgba(239,68,68,.2)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.lineTo((vals.length - 1) * step, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
}

function attachChartTimeframeBtns() {
  qsa(".chart-tf-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const days = btn.dataset.days;
      qsa(".chart-tf-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      try {
        const chart = await api("/coins/" + state.modalCoinId + "/market_chart", {
          vs_currency: state.currency, days: days,
        });
        state.chartData = chart;
        drawModalChart(chart.prices);
      } catch (e) {
        console.error("Chart reload error:", e);
      }
    });
  });
}

function closeModal() {
  $("modal-overlay").classList.remove("active");
  document.body.style.overflow = "";
  state.modalCoinId = null;
}

$("modal-body").addEventListener("click", (e) => {
  if (e.target.closest("#modal-close")) closeModal();
});
$("modal-overlay").addEventListener("click", (e) => {
  if (e.target === $("modal-overlay")) closeModal();
});

$("coin-table-body").addEventListener("click", (e) => {
  const row = e.target.closest("tr[data-id]");
  if (row) openModal(row.dataset.id);
});

document.addEventListener("click", (e) => {
  const item = e.target.closest(".trending-item, .gainer-item");
  if (item && item.dataset.id) openModal(item.dataset.id);
});

const currencyToggle = $("currency-toggle");
const currencyDropdown = $("currency-dropdown");

currencyToggle.addEventListener("click", () => {
  currencyDropdown.classList.toggle("active");
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".currency-toggle") && !e.target.closest(".currency-dropdown")) {
    currencyDropdown.classList.remove("active");
  }
});

qsa(".currency-option").forEach(btn => {
  btn.addEventListener("click", () => {
    const cur = btn.dataset.currency;
    state.currency = cur;
    state.page = 1;
    $("currency-label").textContent = cur.toUpperCase();
    qsa(".currency-option").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currencyDropdown.classList.remove("active");
    refreshAll();
  });
});

$("prev-page").addEventListener("click", () => {
  if (state.page > 1) { state.page--; loadCoins().then(renderGainersLosers); }
});
$("next-page").addEventListener("click", () => {
  state.page++;
  loadCoins().then(renderGainersLosers);
});
const perPageToggle = $("per-page-toggle");
const perPageDropdown = $("per-page-dropdown");

perPageToggle.addEventListener("click", () => {
  perPageDropdown.classList.toggle("active");
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".per-page-wrapper")) {
    perPageDropdown.classList.remove("active");
  }
});

qsa(".per-page-option").forEach(btn => {
  btn.addEventListener("click", () => {
    const val = parseInt(btn.dataset.value);
    state.perPage = val;
    state.page = 1;
    $("per-page-label").textContent = val;
    qsa(".per-page-option").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    perPageDropdown.classList.remove("active");
    loadCoins().then(renderGainersLosers);
  });
});

async function refreshAll() {
  await Promise.all([loadGlobal(), loadCoins(), loadTrending()]);
  renderGainersLosers();
}

async function init() {
  await refreshAll();
  setTimeout(() => {
    $("loading-overlay").classList.add("hidden");
  }, 1200);
  setInterval(refreshAll, 60000);
}

init();
})();
