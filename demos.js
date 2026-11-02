// Interactive case-study demos. Every number here is generated sample data
// (seeded, so it is identical on every visit) — none of it is client data.

const SVG_NS = "http://www.w3.org/2000/svg";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const nf = new Intl.NumberFormat("en-US");
const compactFormat = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const compact = (v) => compactFormat.format(v);
const tickFormat = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });
const tick = (v) => tickFormat.format(v);
const kes = (v) => `KES ${compact(v)}`;
const pct = (v) => `${(v * 100).toFixed(1)}%`;
const signedPct = (v) => `${v < 0 ? "−" : "+"}${Math.abs(v * 100).toFixed(1)}%`;
const sum = (values) => values.reduce((a, b) => a + b, 0);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
let uid = 0;

/* ---------- DOM helpers ---------- */

function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else node.setAttribute(key, value === true ? "" : value);
  }
  node.append(...children.flat().filter((child) => child != null && child !== false));
  return node;
}

function s(tag, attrs = {}, parent) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null) continue;
    if (key === "text") node.textContent = value;
    else node.setAttribute(key, value);
  }
  parent?.append(node);
  return node;
}

function icon(name) {
  if (name === "up" || name === "down") {
    const svg = s("svg", { viewBox: "0 0 12 12", "aria-hidden": "true" });
    s("path", { d: name === "up" ? "M6 2 11 10H1Z" : "M6 10 1 2h10Z" }, svg);
    return svg;
  }
  const svg = s("svg", {
    class: "icon",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": name === "table" ? "2" : "3",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
  });
  const paths = {
    check: ["M20 6 9 17l-5-5"],
    alert: ["M12 6v7", "M12 18v.5"],
    table: ["M3 5h18v14H3z", "M3 10h18", "M9 10v9"],
    arrow: ["M5 12h14", "m13 6 6 6-6 6"],
  };
  for (const d of paths[name]) s("path", { d }, svg);
  return svg;
}

/* ---------- Sample data ---------- */

// Seeded pseudo-random numbers (mulberry32) and an approximately normal draw.
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const normal = (rand) => (rand() + rand() + rand() + rand() - 2) * Math.sqrt(3);

// Two years of monthly sales for a four-region retailer.
function salesData() {
  const rand = seeded(2025);
  const regions = [
    { name: "Nairobi", share: 0.42, aov: 4300, margin: 0.345 },
    { name: "Mombasa", share: 0.24, aov: 5100, margin: 0.312 },
    { name: "Kisumu", share: 0.18, aov: 3600, margin: 0.296 },
    { name: "Nakuru", share: 0.16, aov: 4700, margin: 0.328 },
  ];
  const season = [0.86, 0.8, 0.92, 0.88, 0.95, 0.97, 1, 1.04, 0.98, 1.05, 1.16, 1.39];
  const rows = [];
  for (let t = 0; t < 24; t++) {
    const year = 2024 + Math.floor(t / 12);
    const month = t % 12;
    for (const region of regions) {
      const orders = Math.round(3200 * region.share * season[month] * (1 + 0.007 * t) * (1 + 0.05 * normal(rand)));
      const aov = region.aov * (1 + 0.002 * t) * (1 + 0.025 * normal(rand));
      const revenue = Math.round(orders * aov);
      const margin = region.margin + (year === 2025 ? 0.01 : 0) + 0.006 * normal(rand);
      rows.push({ year, month, region: region.name, orders, revenue, profit: Math.round(revenue * margin) });
    }
  }
  return { regions: regions.map((region) => region.name), rows };
}

// Four years of monthly demand with trend and a year-end peak.
function demandSeries() {
  const rand = seeded(42);
  const season = [-60, -95, -40, -20, 0, 15, 25, 20, 5, 30, 85, 135];
  return Array.from({ length: 48 }, (_, t) =>
    Math.round(900 + 7.5 * t + season[t % 12] * (1 + t / 96) + 38 * normal(rand))
  );
}

// Holt-Winters with additive seasonality. Returns point forecasts with an
// 80% interval that widens with the horizon.
function holtWinters(y, horizon, { alpha = 0.35, beta = 0.05, gamma = 0.3, period = 12 } = {}) {
  let level = sum(y.slice(0, period)) / period;
  let trend = (sum(y.slice(period, 2 * period)) - sum(y.slice(0, period))) / (period * period);
  const season = y.slice(0, period).map((v) => v - level);
  const errors = [];

  for (let t = period; t < y.length; t++) {
    const s0 = season[t % period];
    errors.push(y[t] - (level + trend + s0));
    const previousLevel = level;
    level = alpha * (y[t] - s0) + (1 - alpha) * (level + trend);
    trend = beta * (level - previousLevel) + (1 - beta) * trend;
    season[t % period] = gamma * (y[t] - level) + (1 - gamma) * s0;
  }

  const sigma = Math.sqrt(sum(errors.map((e) => e * e)) / errors.length);
  return Array.from({ length: horizon }, (_, k) => {
    const mean = level + (k + 1) * trend + season[(y.length + k) % period];
    const spread = 1.2816 * sigma * Math.sqrt(1 + k * alpha * alpha);
    return { mean, lo: mean - spread, hi: mean + spread };
  });
}

/* ---------- Controls ---------- */

function segmented(label, options, current, onChange) {
  const group = h("div", { class: "seg", role: "group", "aria-label": label });
  const buttons = options.map(([value, text]) => {
    const button = h("button", { type: "button", "aria-pressed": String(value === current) }, text);
    button.addEventListener("click", () => {
      if (button.disabled) return;
      buttons.forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      onChange(value);
    });
    return button;
  });
  group.append(...buttons);
  const control = h("div", { class: "control" }, h("span", { class: "control-label", "aria-hidden": "true", text: label }), group);
  control.buttons = buttons;
  return control;
}

function selectControl(label, options, onChange) {
  const id = `select-${++uid}`;
  const select = h("select", { class: "select", id }, options.map(([value, text]) => h("option", { value }, text)));
  select.addEventListener("change", () => onChange(select.value));
  return h("div", { class: "control" }, h("label", { class: "control-label", for: id, text: label }), select);
}

// delta: { value, text, vs } for a signed change; note: a plain line of context.
function stat(label, value, delta, { note, text = false } = {}) {
  const tile = h(
    "div",
    { class: text ? "stat stat-text" : "stat" },
    h("p", { class: "stat-label", text: label }),
    h("p", { class: "stat-value", text: value }),
    note ? h("p", { class: "stat-note", text: note }) : null
  );
  if (delta) {
    const direction = delta.value < 0 ? "down" : "up";
    tile.append(h("p", { class: `delta ${direction}` }, icon(direction), delta.text, h("span", { class: "vs", text: delta.vs })));
  }
  return tile;
}

function legend(items) {
  return h(
    "ul",
    { class: "legend" },
    items.map(([key, shape, text]) => h("li", {}, h("span", { class: `key key-${shape} ${key}`, "aria-hidden": "true" }), text))
  );
}

function dataTable(caption, headers, rows) {
  return h(
    "table",
    { class: "data-table" },
    h("caption", { text: caption }),
    h("thead", {}, h("tr", {}, headers.map((text) => h("th", { scope: "col", text })))),
    h("tbody", {}, rows.map((row) => h("tr", {}, row.map((text, i) => (i === 0 ? h("th", { scope: "row", text }) : h("td", { text }))))))
  );
}

// A "Show data table" button: the table view of every chart.
function tableToggle(build) {
  const id = `table-${++uid}`;
  const wrap = h("div", { class: "table-wrap", id, hidden: true });
  const text = h("span", { text: "Show data table" });
  const button = h("button", { class: "text-btn", type: "button", "aria-expanded": "false", "aria-controls": id }, icon("table"), text);
  button.addEventListener("click", () => {
    const open = button.getAttribute("aria-expanded") !== "true";
    button.setAttribute("aria-expanded", String(open));
    text.textContent = open ? "Hide data table" : "Show data table";
    wrap.hidden = !open;
    if (open) wrap.replaceChildren(build());
  });
  return {
    button,
    wrap,
    refresh() {
      if (!wrap.hidden) wrap.replaceChildren(build());
    },
  };
}

/* ---------- Chart frame: sizing, tooltip, keyboard ---------- */

// render(svg, width, height) draws the chart and returns
// { count, defaultIndex, indexAt(x, y), highlight(i), info(i) }.
function chart(host, { height, label, render }) {
  const wrap = h("div", { class: "chart" });
  const svg = s("svg", { class: "chart-svg", role: "img", "aria-label": label, tabindex: "0", height });
  const hint = h("p", { class: "sr-only", id: `hint-${++uid}`, text: "Use the arrow keys to read values." });
  const tip = h("div", { class: "chart-tip", "aria-hidden": "true" });
  const live = h("p", { class: "sr-only", "aria-live": "polite" });
  svg.setAttribute("aria-describedby", hint.id);
  wrap.append(svg, tip, hint, live);
  host.append(wrap);

  const api = { svg, width: 0, active: null, view: null };

  function show(index, announce = false) {
    const view = api.view;
    api.active = index == null || !view ? null : clamp(index, 0, view.count - 1);
    view?.highlight(api.active);
    if (api.active == null) {
      tip.classList.remove("is-on");
      return;
    }
    const info = view.info(api.active);
    tip.replaceChildren(
      h("p", { class: "tip-title", text: info.title }),
      ...info.rows.map((row) =>
        h(
          "p",
          { class: "tip-row" },
          h("span", { class: `key key-${row.shape || "line"} ${row.key || ""}`, "aria-hidden": "true" }),
          h("strong", { text: row.value }),
          h("span", { class: "tip-name", text: row.name })
        )
      )
    );
    tip.classList.add("is-on");
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    let left = info.x + 14;
    if (left + tw > api.width) left = info.x - tw - 14;
    left = clamp(left, 0, Math.max(0, api.width - tw));
    const top = clamp(info.y - th / 2, 0, Math.max(0, height - th));
    tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    if (announce) live.textContent = `${info.title}: ${info.rows.map((row) => `${row.name} ${row.value}`).join(", ")}`;
  }

  api.draw = () => {
    if (!api.width) return;
    svg.replaceChildren();
    svg.setAttribute("viewBox", `0 0 ${api.width} ${height}`);
    svg.setAttribute("height", height);
    api.view = render(svg, api.width, height);
    show(api.active);
  };

  const pointer = (event) => {
    if (!api.view) return;
    const box = svg.getBoundingClientRect();
    const index = api.view.indexAt(event.clientX - box.left, event.clientY - box.top);
    if (index !== api.active) show(index);
  };
  svg.addEventListener("pointermove", pointer);
  svg.addEventListener("pointerdown", pointer);
  // A mouse leaving hides the tooltip; after a tap it stays until the next tap elsewhere.
  svg.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "mouse") show(null);
  });
  const tapAway = (event) => {
    if (!wrap.isConnected) return document.removeEventListener("pointerdown", tapAway);
    if (!wrap.contains(event.target)) show(null);
  };
  document.addEventListener("pointerdown", tapAway);
  svg.addEventListener("focus", () => show(api.active ?? api.view?.defaultIndex ?? 0, true));
  svg.addEventListener("blur", () => show(null));
  svg.addEventListener("keydown", (event) => {
    if (!api.view) return;
    const last = api.view.count - 1;
    const current = api.active ?? api.view.defaultIndex ?? 0;
    const keys = {
      ArrowRight: current + 1,
      ArrowDown: current + 1,
      ArrowLeft: current - 1,
      ArrowUp: current - 1,
      Home: 0,
      End: last,
    };
    if (event.key === "Escape") return show(null);
    if (!(event.key in keys)) return;
    event.preventDefault();
    show(keys[event.key], true);
  });

  new ResizeObserver(([entry]) => {
    const width = Math.round(entry.contentRect.width);
    if (width && width !== api.width) {
      api.width = width;
      api.draw();
    }
  }).observe(wrap);

  return api;
}

/* ---------- Chart pieces ---------- */

function niceStep(range, target = 4) {
  const raw = range / target;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const n = raw / magnitude;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * magnitude;
}

const scale = (d0, d1, r0, r1) => (v) => r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0);

function yGrid(svg, { lo, hi, step, y, x0, x1, format }) {
  for (let v = lo; v <= hi + step / 1e6; v += step) {
    const yy = Math.round(y(v)) + 0.5;
    s("line", { class: v === 0 ? "g-axis" : "g-grid", x1: x0, x2: x1, y1: yy, y2: yy }, svg);
    s("text", { class: "g-tick", x: x0 - 8, y: yy, "text-anchor": "end", "dominant-baseline": "middle", text: format(v) }, svg);
  }
}

// Columns: 4px rounded data end, square at the baseline.
function columnPath(x, w, yTop, yBase, r = 4) {
  const rr = Math.min(r, w / 2, Math.max(0, yBase - yTop));
  return `M${x},${yBase}V${yTop + rr}a${rr},${rr} 0 0 1 ${rr},${-rr}H${x + w - rr}a${rr},${rr} 0 0 1 ${rr},${rr}V${yBase}Z`;
}

function barPath(x0, x1, y, hgt, r = 4) {
  const rr = Math.min(r, hgt / 2, Math.max(0, x1 - x0));
  return `M${x0},${y}H${x1 - rr}a${rr},${rr} 0 0 1 ${rr},${rr}V${y + hgt - rr}a${rr},${rr} 0 0 1 ${-rr},${rr}H${x0}Z`;
}

const linePath = (points) => points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");

/* ---------- Demo 1: KPI dashboard ---------- */

function kpiDemo(root) {
  const { regions, rows } = salesData();
  const periods = {
    year: { label: "Full year", months: [...MONTHS.keys()] },
    q1: { label: "Q1", months: [0, 1, 2] },
    q2: { label: "Q2", months: [3, 4, 5] },
    q3: { label: "Q3", months: [6, 7, 8] },
    q4: { label: "Q4", months: [9, 10, 11] },
  };
  const state = { period: "year", region: "all" };
  let current = [];
  let prior = [];

  const totals = (year, months) => {
    const picked = rows.filter(
      (row) => row.year === year && months.includes(row.month) && (state.region === "all" || row.region === state.region)
    );
    return {
      orders: sum(picked.map((row) => row.orders)),
      revenue: sum(picked.map((row) => row.revenue)),
      profit: sum(picked.map((row) => row.profit)),
    };
  };
  const monthly = (year) => MONTHS.map((_, m) => totals(year, [m]).revenue);
  const growth = (now, before) => ({ value: now - before, text: signedPct(now / before - 1), vs: "vs 2024" });
  const points = (now, before) => ({
    value: now - before,
    text: `${now < before ? "−" : "+"}${Math.abs((now - before) * 100).toFixed(1)} pts`,
    vs: "vs 2024",
  });

  const body = root.querySelector(".demo-body");
  const tiles = h("div", { class: "tiles" });
  const chartHost = h("div");
  const table = tableToggle(() =>
    dataTable(
      `Monthly revenue (KES), ${state.region === "all" ? "all regions" : state.region}`,
      ["Month", "2025", "2024", "Change"],
      MONTHS.map((m, i) => [m, nf.format(current[i]), nf.format(prior[i]), signedPct(current[i] / prior[i] - 1)])
    )
  );

  body.replaceChildren(
    h(
      "div",
      { class: "controls" },
      segmented("Period, 2025", Object.entries(periods).map(([key, p]) => [key, p.label]), state.period, (value) => {
        state.period = value;
        update();
      }),
      selectControl("Region", [["all", "All regions"], ...regions.map((r) => [r, r])], (value) => {
        state.region = value;
        update();
      })
    ),
    tiles,
    h("div", { class: "chart-head" }, h("p", { class: "chart-title", text: "Monthly revenue, 2025 vs 2024" }), legend([["k-s1", "rect", "2025"], ["k-prior", "line", "2024"]])),
    chartHost,
    h("div", { class: "chart-foot" }, h("p", { class: "chart-note", text: "Revenue in Kenyan shillings (KES). Hover, tap or use arrow keys for values." }), table.button),
    table.wrap
  );

  const revenueChart = chart(chartHost, {
    height: 230,
    label: "Monthly revenue chart",
    render(svg, width, height) {
      const highlighted = periods[state.period].months;
      const m = { top: 20, right: 4, bottom: 24, left: 44 };
      const iw = width - m.left - m.right;
      const max = Math.max(...current, ...prior);
      const step = niceStep(max);
      const hi = Math.ceil(max / step) * step;
      const y = scale(0, hi, height - m.bottom, m.top);
      const band = iw / 12;
      const bw = Math.min(24, band * 0.62);
      const cx = (i) => m.left + band * (i + 0.5);

      yGrid(svg, { lo: 0, hi, step, y, x0: m.left, x1: width - m.right, format: tick });
      const bars = current.map((v, i) =>
        s("path", { class: `g-bar${highlighted.includes(i) ? "" : " is-muted"}`, d: columnPath(cx(i) - bw / 2, bw, y(v), y(0)) }, svg)
      );
      s("path", { class: "g-line g-prior", d: linePath(prior.map((v, i) => [cx(i), y(v)])) }, svg);
      MONTHS.forEach((name, i) =>
        s("text", { class: "g-tick", x: cx(i), y: height - 6, "text-anchor": "middle", text: band < 34 ? name[0] : name }, svg)
      );

      // Label only the peak month of the selected period.
      const peak = highlighted.reduce((a, b) => (current[b] > current[a] ? b : a));
      const labelY = Math.min(y(current[peak]), y(prior[peak])) - 7;
      s("text", { class: "g-label", x: cx(peak), y: labelY, "text-anchor": "middle", text: compact(current[peak]) }, svg);

      return {
        count: 12,
        defaultIndex: peak,
        indexAt: (x) => clamp(Math.floor((x - m.left) / band), 0, 11),
        highlight: (index) => bars.forEach((bar, i) => bar.classList.toggle("is-hover", i === index)),
        info: (i) => ({
          x: cx(i),
          y: y(Math.max(current[i], prior[i])),
          title: `${MONTHS[i]} 2025`,
          rows: [
            { key: "k-s1", value: kes(current[i]), name: "2025" },
            { key: "k-prior", value: kes(prior[i]), name: "2024" },
            { value: signedPct(current[i] / prior[i] - 1), name: "year on year" },
          ],
        }),
      };
    },
  });

  function update() {
    const months = periods[state.period].months;
    const now = totals(2025, months);
    const before = totals(2024, months);
    current = monthly(2025);
    prior = monthly(2024);

    tiles.replaceChildren(
      stat("Revenue, KES", compact(now.revenue), growth(now.revenue, before.revenue)),
      stat("Orders", now.orders < 10000 ? nf.format(now.orders) : compact(now.orders), growth(now.orders, before.orders)),
      stat("Avg order, KES", nf.format(Math.round(now.revenue / now.orders)), growth(now.revenue / now.orders, before.revenue / before.orders)),
      stat("Gross margin", pct(now.profit / now.revenue), points(now.profit / now.revenue, before.profit / before.revenue))
    );

    const where = state.region === "all" ? "all regions" : state.region;
    revenueChart.svg.setAttribute(
      "aria-label",
      `Column chart: monthly revenue in 2025 for ${where}, with 2024 as a line. ${periods[state.period].label} is highlighted. ` +
        `Revenue for the period is ${kes(now.revenue)}, ${signedPct(now.revenue / before.revenue - 1)} on 2024.`
    );
    revenueChart.draw();
    table.refresh();
  }

  update();
}

/* ---------- Demo 2: Forecast with backtest ---------- */

function forecastDemo(root) {
  const actual = demandSeries();
  const label = (i) => `${MONTHS[i % 12]} ${2022 + Math.floor(i / 12)}`;
  const state = { view: "forecast", horizon: 12 };

  // Backtest: fit on 2022–2024, forecast 2025, compare with what happened.
  const train = 36;
  const backtest = holtWinters(actual.slice(0, train), actual.length - train);
  const holdout = actual.slice(train);
  const ape = holdout.map((a, i) => Math.abs(a - backtest[i].mean) / a);
  const mape = sum(ape) / ape.length;
  const bias = sum(holdout.map((a, i) => (backtest[i].mean - a) / a)) / holdout.length;
  const inside = holdout.filter((a, i) => a >= backtest[i].lo && a <= backtest[i].hi).length;

  let forecast = [];
  const body = root.querySelector(".demo-body");
  const tiles = h("div", { class: "tiles tiles-3" });
  const note = h("p", { class: "chart-note" });
  const chartHost = h("div");
  const horizonControl = segmented("Horizon", [[6, "6 mo"], [12, "12 mo"], [18, "18 mo"]], state.horizon, (value) => {
    state.horizon = value;
    update();
  });
  const table = tableToggle(() => {
    const fromBacktest = state.view === "backtest";
    const fc = fromBacktest ? backtest : forecast;
    const offset = fromBacktest ? train : actual.length;
    return dataTable(
      fromBacktest ? "Backtest: forecast vs actual demand, 2025 (units)" : "Demand forecast (units)",
      fromBacktest ? ["Month", "Actual", "Forecast", "Error"] : ["Month", "Forecast", "80% low", "80% high"],
      fc.map((f, k) =>
        fromBacktest
          ? [label(offset + k), nf.format(actual[offset + k]), nf.format(Math.round(f.mean)), signedPct(f.mean / actual[offset + k] - 1)]
          : [label(offset + k), nf.format(Math.round(f.mean)), nf.format(Math.round(f.lo)), nf.format(Math.round(f.hi))]
      )
    );
  });

  body.replaceChildren(
    h(
      "div",
      { class: "controls" },
      segmented("View", [["forecast", "Forecast"], ["backtest", "Backtest"]], state.view, (value) => {
        state.view = value;
        update();
      }),
      horizonControl
    ),
    tiles,
    h(
      "div",
      { class: "chart-head" },
      h("p", { class: "chart-title", text: "Monthly demand (units)" }),
      legend([["k-s1", "line", "Actual"], ["k-dash", "line", "Forecast"], ["k-band", "band", "80% interval"]])
    ),
    chartHost,
    h("div", { class: "chart-foot" }, note, table.button),
    table.wrap
  );

  const demandChart = chart(chartHost, {
    height: 240,
    label: "Demand forecast chart",
    render(svg, width, height) {
      const backtesting = state.view === "backtest";
      const fc = backtesting ? backtest : forecast;
      const start = backtesting ? train : actual.length;
      const count = backtesting ? actual.length : actual.length + fc.length;
      const m = { top: 22, right: 8, bottom: 24, left: 40 };
      const x = scale(0, count - 1, m.left, width - m.right);
      const values = [...actual, ...fc.map((f) => f.lo), ...fc.map((f) => f.hi)];
      const step = niceStep(Math.max(...values) - Math.min(...values), 4);
      const lo = Math.floor(Math.min(...values) / step) * step;
      const hi = Math.ceil(Math.max(...values) / step) * step;
      const y = scale(lo, hi, height - m.bottom, m.top);

      yGrid(svg, { lo, hi, step, y, x0: m.left, x1: width - m.right, format: tick });

      // Year ticks
      for (let i = 0; i < count; i += 12) {
        s("text", { class: "g-tick", x: x(i), y: height - 6, "text-anchor": "start", text: String(2022 + i / 12) }, svg);
      }

      // Where the forecast begins
      const splitX = Math.round(x(start - 0.5)) + 0.5;
      s("line", { class: "g-axis", x1: splitX, x2: splitX, y1: m.top - 6, y2: height - m.bottom }, svg);
      // Label the right side of the split; on narrow charts it moves left of the line.
      const rightLabel = backtesting ? "Holdout 2025" : "Forecast";
      const roomRight = width - splitX - 6 > rightLabel.length * 6.4;
      s("text", { class: "g-note", x: roomRight ? splitX + 6 : splitX - 6, y: m.top - 10, "text-anchor": roomRight ? "start" : "end", text: rightLabel }, svg);
      if (backtesting && roomRight) s("text", { class: "g-note", x: splitX - 6, y: m.top - 10, "text-anchor": "end", text: "Training" }, svg);

      const fcPoints = fc.map((f, k) => [x(start + k), y(f.mean)]);
      const band = [...fc.map((f, k) => [x(start + k), y(f.hi)]), ...fc.map((f, k) => [x(start + k), y(f.lo)]).reverse()];
      s("path", { class: "g-band", d: `${linePath(band)}Z` }, svg);
      s("path", { class: "g-line g-s1", d: linePath(actual.map((v, i) => [x(i), y(v)])) }, svg);
      s("path", { class: "g-line g-s2 g-dash", d: linePath([[x(start - 1), y(actual[start - 1])], ...fcPoints]) }, svg);
      if (!backtesting) s("circle", { class: "g-dot f-s1", cx: x(actual.length - 1), cy: y(actual.at(-1)), r: 4 }, svg);

      // Hover layer
      const cross = s("line", { class: "g-cross", y1: m.top, y2: height - m.bottom, visibility: "hidden" }, svg);
      const dotActual = s("circle", { class: "g-dot f-s1", r: 4, visibility: "hidden" }, svg);
      const dotForecast = s("circle", { class: "g-dot f-s2", r: 4, visibility: "hidden" }, svg);
      const fcAt = (i) => (i >= start && i < start + fc.length ? fc[i - start] : null);

      return {
        count,
        defaultIndex: backtesting ? start : actual.length - 1,
        indexAt: (px) => clamp(Math.round(((px - m.left) / (width - m.left - m.right)) * (count - 1)), 0, count - 1),
        highlight(i) {
          const visible = i == null ? "hidden" : "visible";
          [cross, dotActual, dotForecast].forEach((node) => node.setAttribute("visibility", visible));
          if (i == null) return;
          const xx = Math.round(x(i)) + 0.5;
          cross.setAttribute("x1", xx);
          cross.setAttribute("x2", xx);
          const f = fcAt(i);
          dotActual.setAttribute("visibility", i < actual.length ? "visible" : "hidden");
          if (i < actual.length) {
            dotActual.setAttribute("cx", x(i));
            dotActual.setAttribute("cy", y(actual[i]));
          }
          dotForecast.setAttribute("visibility", f ? "visible" : "hidden");
          if (f) {
            dotForecast.setAttribute("cx", x(i));
            dotForecast.setAttribute("cy", y(f.mean));
          }
        },
        info(i) {
          const f = fcAt(i);
          const rows = [];
          if (i < actual.length) rows.push({ key: "k-s1", value: nf.format(actual[i]), name: "actual" });
          if (f) {
            rows.push({ key: "k-s2", value: nf.format(Math.round(f.mean)), name: "forecast" });
            rows.push({ key: "k-band", shape: "band", value: `${nf.format(Math.round(f.lo))}–${nf.format(Math.round(f.hi))}`, name: "80% interval" });
          }
          return { x: x(i), y: y(i < actual.length ? actual[i] : f.mean), title: label(i), rows };
        },
      };
    },
  });

  function update() {
    const backtesting = state.view === "backtest";
    horizonControl.buttons.forEach((button) => (button.disabled = backtesting));
    forecast = holtWinters(actual, state.horizon);
    const next = forecast[0];

    tiles.replaceChildren(
      ...(backtesting
        ? [
            stat("Holdout error (MAPE)", pct(mape)),
            stat("Months inside the 80% band", `${inside} of ${holdout.length}`),
            stat("Bias", `${signedPct(bias)} ${bias >= 0 ? "over" : "under"}`),
          ]
        : [
            stat(`Forecast, ${label(actual.length)}`, `${nf.format(Math.round(next.mean))} units`),
            stat("80% range, next month", `${nf.format(Math.round(next.lo))}–${nf.format(Math.round(next.hi))}`),
            stat("Backtest error (MAPE)", pct(mape)),
          ])
    );
    note.textContent = backtesting
      ? "Fitted on 2022–2024 only, then scored on 2025: data the model never saw."
      : "Holt-Winters with yearly seasonality, fitted live in your browser.";

    demandChart.svg.setAttribute(
      "aria-label",
      backtesting
        ? `Line chart: actual monthly demand 2022 to 2025 with a backtest forecast for 2025. Holdout error ${pct(mape)} MAPE; ${inside} of ${holdout.length} months fall inside the 80% interval.`
        : `Line chart: actual monthly demand 2022 to 2025 and a ${state.horizon}-month forecast with an 80% interval. Next month: ${nf.format(Math.round(next.mean))} units.`
    );
    demandChart.draw();
    table.refresh();
  }

  update();
}

/* ---------- Demo 3: Pipeline tabs ---------- */

function tabKeys(list, tabs, select) {
  list.addEventListener("keydown", (event) => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const n = tabs.length;
    const keys = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1 + n, ArrowUp: i - 1 + n, Home: 0, End: n - 1 };
    if (!(event.key in keys)) return;
    event.preventDefault();
    select(keys[event.key] % n, true);
  });
}

function pipelineDemo(root) {
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const panels = tabs.map((tab) => document.getElementById(tab.getAttribute("aria-controls")));
  const select = (index, focus) => {
    tabs.forEach((tab, i) => {
      tab.setAttribute("aria-selected", String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      panels[i].hidden = i !== index;
      panels[i].classList.toggle("fade-in", i === index);
    });
    if (focus) tabs[index].focus();
  };
  tabs.forEach((tab, i) => tab.addEventListener("click", () => select(i)));
  tabKeys(root.querySelector('[role="tablist"]'), tabs, select);
  select(0);
}

/* ---------- Code highlighting ---------- */

const KEYWORDS = {
  SQL: "SELECT FROM WHERE GROUP BY ORDER AS INSERT INTO UNION ALL WITH OVER PARTITION DESC ASC AND OR NOT NULL IS CAST DATE JOIN ON",
  Python: "import from as def return for in if else and or not None True False with lambda",
  DAX: "VAR RETURN",
};

function highlight(code, lang) {
  const words = new Set((KEYWORDS[lang] || "").split(" "));
  const comment = lang === "Python" ? "#" : "--";
  const pattern = new RegExp(`(${comment}[^\\n]*)|('[^'\\n]*'|"[^"\\n]*")|(\\b\\d+(?:\\.\\d+)?\\b)|([A-Za-z_]\\w*)`, "g");
  const text = code.textContent;
  const out = document.createDocumentFragment();
  let last = 0;

  for (const match of text.matchAll(pattern)) {
    const [token, isComment, isString, isNumber, word] = match;
    let cls = isComment ? "tk-c" : isString ? "tk-s" : isNumber ? "tk-n" : null;
    if (word) {
      const keyword = lang === "Python" ? words.has(word) : word === word.toUpperCase() && words.has(word);
      if (keyword) cls = "tk-k";
      else if (/^\s?\(/.test(text.slice(match.index + token.length, match.index + token.length + 2))) cls = "tk-f";
    }
    if (match.index > last) out.append(text.slice(last, match.index));
    out.append(cls ? h("span", { class: cls, text: token }) : token);
    last = match.index + token.length;
  }
  out.append(text.slice(last));
  code.replaceChildren(out);
}

function codeBlock(lang, source) {
  const code = h("code", { text: source });
  highlight(code, lang);
  return h("pre", { class: "code", "data-lang": lang }, code);
}

/* ---------- Demo 4: How I work, on nine rows ---------- */

const RAW_ORDERS = [
  ["1001", "2026-01-03", "Nairobi", "4,200"],
  ["1002", "03/01/2026", " nairobi ", "3,150"],
  ["1003", "Jan 4 2026", "Mombasa", "N/A"],
  ["1004", "2026-01-04", "MOMBASA", "5,600"],
  ["1004", "2026-01-04", "MOMBASA", "5,600"],
  ["1005", "2026-01-05", "Kisumu", "2,900"],
  ["1006", "05/01/2026", "kisumu", "3,400"],
  ["1007", "2026-01-06", "Nakuru", "4,800"],
  ["1008", "2026-01-06", "Nairobi", "6,100"],
];

function parseDate(text) {
  let m;
  if ((m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/))) return text;
  if ((m = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/))) return `${m[3]}-${m[2]}-${m[1]}`; // day first
  if ((m = text.match(/^([A-Z][a-z]{2}) (\d{1,2}) (\d{4})$/))) {
    return `${m[3]}-${String(MONTHS.indexOf(m[1]) + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  return null;
}

const titleCase = (text) => text.trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const parseAmount = (text) => (/^[\d,]+$/.test(text) ? Number(text.replace(/,/g, "")) : null);

function cleanOrders(raw) {
  const seen = new Set();
  const fixes = { dates: 0, regions: 0, missing: 0, duplicates: 0 };
  const rows = raw.map(([id, date, region, amount]) => {
    const key = [id, date, region, amount].join("|");
    if (seen.has(key)) {
      fixes.duplicates++;
      return { id, raw: [id, date, region, amount], removed: true };
    }
    seen.add(key);
    const clean = { date: parseDate(date), region: titleCase(region), amount: parseAmount(amount) };
    const changed = { date: clean.date !== date, region: clean.region !== region, amount: clean.amount === null };
    fixes.dates += changed.date;
    fixes.regions += changed.region;
    fixes.missing += changed.amount;
    return { id, raw: [id, date, region, amount], ...clean, changed };
  });
  return { rows, fixes };
}

function processDemo(root) {
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const panel = root.querySelector('[role="tabpanel"]');
  const { rows, fixes } = cleanOrders(RAW_ORDERS);
  const kept = rows.filter((row) => !row.removed);
  const valid = kept.filter((row) => row.amount != null);
  const missing = kept.filter((row) => row.amount == null);
  const revenue = sum(valid.map((row) => row.amount));
  const problems = fixes.dates + fixes.regions + fixes.missing + fixes.duplicates;

  const byRegion = [...new Set(valid.map((row) => row.region))]
    .map((region) => {
      const orders = valid.filter((row) => row.region === region);
      const total = sum(orders.map((row) => row.amount));
      return { region, total, orders: orders.length, aov: total / orders.length, share: total / revenue };
    })
    .sort((a, b) => b.total - a.total);
  const top = byRegion[0];
  const biggestBasket = [...byRegion].sort((a, b) => b.aov - a.aov)[0];
  let showClean = false;

  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const head = (title, ...extra) => h("div", { class: "pd-head" }, h("h3", { class: "pd-title", text: title }), ...extra);
  const intro = (text) => h("p", { class: "pd-intro", text });
  const pill = (kind, text) => h("li", { class: `pill pill-${kind}` }, icon(kind === "issue" ? "alert" : "check"), text);

  function ordersTable() {
    const showSpaces = (text) => text.replace(/^ +| +$/g, (spaces) => "·".repeat(spaces.length));
    const cell = (text, state, note) =>
      h("td", { class: state ? `cell-${state}` : null }, text, note ? h("span", { class: "sr-only", text: ` (${note})` }) : null);

    const body = rows.map((row) => {
      const [id, date, region, amount] = row.raw;
      if (row.removed) {
        return showClean
          ? h("tr", { class: "row-removed" }, h("th", { scope: "row", text: id }), h("td", { text: date }), h("td", { text: region }), h("td", { text: "removed" }))
          : h("tr", {}, h("th", { scope: "row", class: "cell-issue" }, id, h("span", { class: "sr-only", text: " (duplicate row)" })),
              cell(date, "issue"), cell(region, "issue"), cell(amount, "issue"));
      }
      const c = row.changed;
      return showClean
        ? h("tr", {}, h("th", { scope: "row", text: id }),
            cell(row.date, c.date && "fixed", c.date && "fixed"),
            cell(row.region, c.region && "fixed", c.region && "fixed"),
            cell(row.amount == null ? "flagged" : nf.format(row.amount), c.amount && "issue", c.amount && "needs review"))
        : h("tr", {}, h("th", { scope: "row", text: id }),
            cell(date, c.date && "issue", c.date && "mixed date format"),
            cell(showSpaces(region), c.region && "issue", c.region && "inconsistent name"),
            cell(amount, c.amount && "issue", c.amount && "missing amount"));
    });

    return h(
      "div",
      { class: "table-wrap" },
      h(
        "table",
        { class: "data-table" },
        h("caption", { text: showClean ? "Cleaned orders: green cells were changed." : "Raw orders: highlighted cells have a problem." }),
        h("thead", {}, h("tr", {}, ["Order", "Date", "Region", "Amount (KES)"].map((text) => h("th", { scope: "col", text })))),
        h("tbody", {}, body)
      )
    );
  }

  const steps = [
    function clean(content) {
      const view = h("div");
      const render = () => {
        view.replaceChildren(
          ordersTable(),
          h(
            "ul",
            { class: "pills", "aria-label": showClean ? "What the cleaning changed" : "Problems found" },
            showClean
              ? [
                  pill("fixed", `${plural(fixes.dates, "date")} standardized`),
                  pill("fixed", `${plural(fixes.regions, "region name")} fixed`),
                  pill("fixed", `${plural(fixes.duplicates, "duplicate")} removed`),
                  pill("issue", `${plural(fixes.missing, "missing amount")} flagged for review`),
                ]
              : [
                  pill("issue", `${plural(fixes.dates, "mixed date format")}`),
                  pill("issue", `${plural(fixes.regions, "inconsistent region name")}`),
                  pill("issue", `${plural(fixes.missing, "missing amount")}`),
                  pill("issue", `${plural(fixes.duplicates, "duplicate row")}`),
                ]
          )
        );
      };
      content.append(
        head(
          `${RAW_ORDERS.length} raw rows, ${problems} problems`,
          segmented("Show", [[false, "Raw"], [true, "Cleaned"]], showClean, (value) => {
            showClean = value;
            render();
          })
        ),
        intro("A typical export: three systems, three date formats, inconsistent names and a copy-paste duplicate. Toggle to see what the cleaning step changes."),
        view
      );
      render();
    },

    function metrics(content) {
      content.append(
        head("Agree what each number means"),
        intro("Before any chart, every KPI gets a written definition, so everyone reads the same number the same way."),
        h(
          "div",
          { class: "metrics" },
          [
            ["Revenue", "SUM(amount)", `KES ${nf.format(revenue)}`],
            ["Valid orders", "COUNT(amount)", String(valid.length)],
            ["Avg order value", "revenue ÷ valid orders", `KES ${nf.format(Math.round(revenue / valid.length))}`],
          ].map(([name, formula, value]) =>
            h("div", { class: "metric" }, h("p", { class: "metric-name", text: name }), h("p", { class: "metric-formula", text: formula }), h("p", { class: "metric-value", text: value }))
          )
        ),
        h("p", { class: "caveat", text: `Order ${missing.map((row) => row.id).join(", ")} is left out until its amount is confirmed, rather than counted as zero.` }),
        h(
          "div",
          { class: "pd-code" },
          codeBlock(
            "SQL",
            "SELECT SUM(amount)                 AS revenue,\n       COUNT(amount)               AS valid_orders,\n       SUM(amount) / COUNT(amount) AS avg_order_value\nFROM clean.orders;"
          )
        )
      );
    },

    function visualize(content) {
      const chartHost = h("div");
      const table = tableToggle(() =>
        dataTable("Revenue by region (KES)", ["Region", "Revenue", "Orders", "Avg order", "Share"],
          byRegion.map((r) => [r.region, nf.format(r.total), String(r.orders), nf.format(Math.round(r.aov)), pct(r.share)]))
      );
      content.append(
        head("Where does the revenue come from?"),
        intro("One question, one chart. Sorted so the answer is the first thing you see."),
        h("p", { class: "chart-title", text: "Revenue by region, KES" }),
        chartHost,
        h("div", { class: "chart-foot" }, h("p", { class: "chart-note", text: `${top.region} brings in ${pct(top.share)} of revenue.` }), table.button),
        table.wrap
      );
      chart(chartHost, {
        height: byRegion.length * 46 + 8,
        label: `Bar chart of revenue by region: ${byRegion.map((r) => `${r.region} KES ${nf.format(r.total)}`).join(", ")}.`,
        render(svg, width, height) {
          const m = { top: 4, right: 64, bottom: 4, left: 72 };
          const rowH = (height - m.top - m.bottom) / byRegion.length;
          const bh = Math.min(24, rowH * 0.6);
          const x = scale(0, top.total, m.left, width - m.right);
          const cy = (i) => m.top + rowH * (i + 0.5);
          const bars = byRegion.map((r, i) => {
            s("text", { class: "g-cat", x: m.left - 10, y: cy(i), "text-anchor": "end", "dominant-baseline": "middle", text: r.region }, svg);
            const bar = s("path", { class: "g-bar", d: barPath(x(0), x(r.total), cy(i) - bh / 2, bh) }, svg);
            s("text", { class: "g-label", x: x(r.total) + 8, y: cy(i), "dominant-baseline": "middle", text: nf.format(r.total) }, svg);
            return bar;
          });
          s("line", { class: "g-axis", x1: x(0) + 0.5, x2: x(0) + 0.5, y1: m.top, y2: height - m.bottom }, svg);
          return {
            count: byRegion.length,
            defaultIndex: 0,
            indexAt: (_, py) => clamp(Math.floor((py - m.top) / rowH), 0, byRegion.length - 1),
            highlight: (index) => bars.forEach((bar, i) => bar.classList.toggle("is-hover", i === index)),
            info: (i) => ({
              x: x(byRegion[i].total),
              y: cy(i),
              title: byRegion[i].region,
              rows: [
                { key: "k-s1", value: `KES ${nf.format(byRegion[i].total)}`, name: "revenue" },
                { value: String(byRegion[i].orders), name: byRegion[i].orders === 1 ? "order" : "orders" },
                { value: `KES ${nf.format(Math.round(byRegion[i].aov))}`, name: "avg order" },
              ],
            }),
          };
        },
      });
    },

    function validate(content) {
      const regionTotal = sum(byRegion.map((r) => r.total));
      const checks = [
        [kept.length === RAW_ORDERS.length - fixes.duplicates, `Row count reconciles: ${RAW_ORDERS.length} raw rows − ${fixes.duplicates} duplicate = ${kept.length} orders`],
        [regionTotal === revenue, `Region totals add up to total revenue (KES ${nf.format(revenue)})`],
        [new Set(kept.map((row) => row.id)).size === kept.length, "No duplicate order IDs remain"],
        [missing.length === 0, missing.length ? `Order ${missing[0].id} (${missing[0].region}) has no amount: sent back to sales ops to confirm` : "No missing amounts"],
      ];
      const missingRegion = missing[0]?.region;
      content.append(
        head("Check it, then say what to do"),
        h(
          "ul",
          { class: "checks" },
          checks.map(([ok, text]) =>
            h(
              "li",
              { class: `check ${ok ? "pass" : "warn"}` },
              h("span", { class: "check-icon" }, icon(ok ? "check" : "alert")),
              h("span", {}, h("span", { class: "check-status", text: ok ? "Pass: " : "Needs follow-up: " }), text)
            )
          )
        ),
        h(
          "div",
          { class: "callout" },
          h("p", { class: "callout-label", text: "Recommendation" }),
          h(
            "p",
            {
              text:
                `${top.region} drives ${pct(top.share)} of revenue, but ${biggestBasket.region} has the largest average order ` +
                `(KES ${nf.format(Math.round(biggestBasket.aov))}${biggestBasket.orders === 1 ? ", from a single order" : ""}). ` +
                (missingRegion === biggestBasket.region ? `Confirm the missing ${missingRegion} order first, then ` : "Next, ") +
                `test whether ${biggestBasket.region}'s bigger baskets justify more sales coverage there.`,
            }
          )
        ),
        h("p", { class: "caveat", text: "Nine rows can't support a real decision. On a full dataset I'd confirm the gap holds over time and is statistically significant before recommending a change." })
      );
    },
  ];

  function select(index, { focusTab = false, focusPanel = false } = {}) {
    tabs.forEach((tab, i) => {
      tab.setAttribute("aria-selected", String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
    });
    panel.setAttribute("aria-labelledby", tabs[index].id);

    const content = h("div", { class: "fade-in" });
    steps[index](content);
    const last = index === steps.length - 1;
    const next = h(
      "button",
      { class: "btn btn-ghost btn-sm", type: "button" },
      last ? "Start over" : `Next: ${tabs[index + 1].querySelector(".pd-name").textContent}`,
      icon("arrow")
    );
    next.addEventListener("click", () => select(last ? 0 : index + 1, { focusPanel: true }));
    content.append(h("div", { class: "pd-foot" }, h("p", { class: "pd-progress", text: `Step ${index + 1} of ${steps.length}` }), next));
    panel.replaceChildren(content);

    if (focusTab) tabs[index].focus();
    if (focusPanel) {
      panel.focus({ preventScroll: true });
      // On phones "Next" sits far below the panel's top: bring the new step into view.
      if (panel.getBoundingClientRect().top < 0) {
        panel.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      }
    }
  }

  tabs.forEach((tab, i) => tab.addEventListener("click", () => select(i)));
  tabKeys(root.querySelector('[role="tablist"]'), tabs, (i, focus) => select(i, { focusTab: focus }));
  select(0);
}

/* ---------- Demo 5: Eat That Frog prioritizer ---------- */

// Method from Brian Tracy's "Eat That Frog!": sort tasks with the ABCDE
// method, then check the 80/20 rule against each task's value score.
const LETTERS = {
  A: "A · must do",
  B: "B · should do",
  C: "C · nice to do",
  D: "D · delegate",
  E: "E · eliminate",
};

const FROG_TASKS = [
  { name: "Finish the Q3 revenue dashboard for leadership", short: "Q3 dashboard", value: 40, hours: 6, letter: "A" },
  { name: "Fix duplicate orders in the sales pipeline", short: "Fix duplicates", value: 28, hours: 3, letter: "A" },
  { name: "Run the forecast backtest for Friday's review", short: "Backtest", value: 12, hours: 4, letter: "A" },
  { name: "Update the data dictionary", short: "Data dictionary", value: 6, hours: 2, letter: "B" },
  { name: "Try a new Power BI feature", short: "New Power BI feature", value: 4, hours: 1.5, letter: "C" },
  { name: "Send the weekly KPI email", short: "Weekly KPI email", value: 3, hours: 1, letter: "D" },
  { name: "Coffee chat with a new analyst", short: "Coffee chat", value: 3, hours: 0.5, letter: "C" },
  { name: "Reply to non-urgent emails", short: "Non-urgent emails", value: 2, hours: 1.5, letter: "B" },
  { name: "Restyle an old Excel report", short: "Restyle Excel report", value: 1, hours: 2, letter: "E" },
  { name: "Tidy up desktop files", short: "Tidy desktop", value: 1, hours: 0.5, letter: "E" },
];

function frogDemo(root) {
  let tasks = FROG_TASKS.map((task) => ({ ...task }));
  const body = root.querySelector(".demo-body");
  const tiles = h("div", { class: "tiles tiles-3" });
  const chartHost = h("div");
  const list = h("ol", { class: "frog-list", "aria-label": "Tasks: set a letter and a value score for each" });
  const reset = h("button", { class: "text-btn", type: "button" }, "Reset sample tasks");
  let ranked = [];

  const table = tableToggle(() =>
    dataTable(
      "Tasks by value: share of total and cumulative share",
      ["Task", "Letter", "Value", "Share", "Cumulative"],
      ranked.map((t) => [t.name, t.letter, String(t.value), pct(t.share), pct(t.cumulative)])
    )
  );

  body.replaceChildren(
    tiles,
    h(
      "div",
      { class: "chart-head" },
      h("p", { class: "chart-title", text: "Share of total value, largest first" }),
      legend([["k-s1", "rect", "The vital few (first 80%)"], ["k-muted", "rect", "The rest"]])
    ),
    chartHost,
    h("div", { class: "chart-foot" }, h("p", { class: "chart-note", text: "Right-hand column: cumulative share of value." }), table.button),
    table.wrap,
    list,
    h("div", { class: "chart-foot" }, h("p", { class: "frog-key", text: "A must do · B should do · C nice to do · D delegate · E eliminate" }), reset)
  );

  // Rank by value for the 80/20 check; priority order is letter first, then value.
  function analyse() {
    const total = sum(tasks.map((t) => t.value)) || 1;
    let running = 0;
    ranked = [...tasks]
      .sort((a, b) => b.value - a.value)
      .map((t) => {
        running += t.value;
        return { ...t, share: t.value / total, cumulative: running / total };
      });
    const vitalFew = Math.max(1, ranked.findIndex((t) => t.cumulative >= 0.8 - 1e-9) + 1);
    const order = [...tasks].sort((a, b) => a.letter.localeCompare(b.letter) || b.value - a.value);
    const counters = {};
    const labels = new Map(order.map((t) => [t, `${t.letter}-${(counters[t.letter] = (counters[t.letter] || 0) + 1)}`]));
    return { total, vitalFew, frog: order.find((t) => t.letter === "A"), labels };
  }

  const chartView = chart(chartHost, {
    height: FROG_TASKS.length * 28 + 54,
    label: "Bar chart of task values",
    render(svg, width, height) {
      const { vitalFew } = analyse();
      const m = { top: 22, right: 56, bottom: 4, left: Math.min(150, width * 0.36) };
      // A gap after the vital few holds the 80% marker.
      const gap = vitalFew < ranked.length ? 24 : 0;
      const rowH = (height - m.top - m.bottom - 24) / ranked.length;
      const bh = Math.min(16, rowH * 0.6);
      const maxShare = Math.max(...ranked.map((t) => t.share), 0.01);
      const x = scale(0, maxShare, m.left, width - m.right - 40);
      const cy = (i) => m.top + rowH * (i + 0.5) + (i >= vitalFew ? gap : 0);

      s("text", { class: "g-note", x: width, y: 11, "text-anchor": "end", text: "Cumulative" }, svg);
      const rows = ranked.map((t, i) => s("rect", { class: "g-row", x: 0, y: cy(i) - rowH / 2, width, height: rowH, fill: "transparent" }, svg));
      const bars = ranked.map((t, i) => {
        s("text", { class: "g-cat", x: m.left - 10, y: cy(i), "text-anchor": "end", "dominant-baseline": "middle", text: t.short }, svg);
        const bar = s("path", { class: `g-bar${i < vitalFew ? "" : " is-muted"}`, d: barPath(x(0), Math.max(x(0) + 1, x(t.share)), cy(i) - bh / 2, bh) }, svg);
        s("text", { class: "g-label", x: Math.max(x(0) + 1, x(t.share)) + 6, y: cy(i), "dominant-baseline": "middle", text: pct(t.share) }, svg);
        s("text", { class: "g-tick", x: width, y: cy(i), "text-anchor": "end", "dominant-baseline": "middle", text: pct(t.cumulative) }, svg);
        return bar;
      });
      s("line", { class: "g-axis", x1: x(0) + 0.5, x2: x(0) + 0.5, y1: m.top - 4, y2: height - m.bottom }, svg);

      // Where the cumulative share passes 80%
      const cutTop = m.top + rowH * vitalFew;
      if (gap) {
        const lineY = Math.round(cutTop + 6) + 0.5;
        s("line", { class: "g-cross", x1: 0, x2: width, y1: lineY, y2: lineY }, svg);
        s("text", { class: "g-note", x: x(0) + 6, y: lineY + 13, text: "80% of value reached above this line" }, svg);
      }

      return {
        count: ranked.length,
        defaultIndex: 0,
        indexAt: (_, py) => clamp(Math.floor((py - m.top - (py > cutTop + gap / 2 ? gap : 0)) / rowH), 0, ranked.length - 1),
        highlight(index) {
          bars.forEach((bar, i) => bar.classList.toggle("is-hover", i === index));
          rows.forEach((row, i) => row.classList.toggle("is-hover", i === index));
        },
        info: (i) => ({
          x: Math.max(x(0) + 1, x(ranked[i].share)),
          y: cy(i),
          title: ranked[i].name,
          rows: [
            { key: i < vitalFew ? "k-s1" : "k-muted", shape: "rect", value: pct(ranked[i].share), name: "of total value" },
            { value: pct(ranked[i].cumulative), name: "cumulative" },
            { value: LETTERS[ranked[i].letter], name: "" },
          ],
        }),
      };
    },
  });

  function update() {
    const { vitalFew, frog, labels } = analyse();
    const dropHours = sum(tasks.filter((t) => t.letter === "D" || t.letter === "E").map((t) => t.hours));
    const vitalShare = ranked[vitalFew - 1].cumulative;

    tiles.replaceChildren(
      stat("Your frog (A-1)", frog ? frog.name : "No A task yet", null, {
        text: true,
        note: frog ? "Do this before anything else." : "Mark the task with serious consequences as A.",
      }),
      stat("The vital few", `${vitalFew} of ${tasks.length} tasks`, null, { note: `carry ${pct(vitalShare)} of the value` }),
      stat("Delegate or drop", `${dropHours} h`, null, { note: "of D and E tasks freed up" })
    );

    list.querySelectorAll(".frog-row").forEach((row, i) => {
      const task = tasks[i];
      const label = labels.get(task);
      row.querySelector(".frog-rank").textContent = task.letter === "D" || task.letter === "E" ? task.letter : label;
      row.classList.toggle("is-frog", task === frog);
      row.classList.toggle("is-dropped", task.letter === "D" || task.letter === "E");
      row.querySelector("output").textContent = String(task.value);
    });

    chartView.svg.setAttribute(
      "aria-label",
      `Bar chart of each task's share of total value, largest first. ${vitalFew} of ${tasks.length} tasks carry ${pct(vitalShare)} of the value.` +
        (frog ? ` The frog is: ${frog.name}.` : "")
    );
    chartView.draw();
    table.refresh();
  }

  function buildList() {
    list.replaceChildren(
      ...tasks.map((task, i) => {
        const id = `frog-${++uid}`;
        const letter = h(
          "select",
          { class: "select frog-letter", "aria-label": `ABCDE letter for: ${task.name}` },
          Object.entries(LETTERS).map(([key, text]) => h("option", { value: key, title: text }, key))
        );
        letter.value = task.letter;
        letter.addEventListener("change", () => {
          task.letter = letter.value;
          update();
        });
        const range = h("input", { type: "range", id, min: "0", max: "50", step: "1", value: String(task.value), "aria-label": `Value score for: ${task.name}` });
        range.addEventListener("input", () => {
          task.value = Number(range.value);
          update();
        });
        return h(
          "li",
          { class: "frog-row" },
          h("span", { class: "frog-rank", "aria-hidden": "true" }),
          letter,
          h("span", { class: "frog-name", text: task.name }),
          range,
          h("output", { for: id })
        );
      })
    );
  }

  reset.addEventListener("click", () => {
    tasks = FROG_TASKS.map((task) => ({ ...task }));
    buildList();
    update();
  });

  buildList();
  update();
}

/* ---------- Start ---------- */

const demos = { kpi: kpiDemo, forecast: forecastDemo, pipeline: pipelineDemo, process: processDemo, frog: frogDemo };

document.querySelectorAll(".code code").forEach((code) => highlight(code, code.parentElement.dataset.lang));
document.querySelectorAll("[data-demo]").forEach((root) => {
  try {
    demos[root.dataset.demo]?.(root);
  } catch (error) {
    console.error(`Demo "${root.dataset.demo}" failed to start`, error);
  }
});
