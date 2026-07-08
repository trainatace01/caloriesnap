/* ============ CalorieSnap charts ============
   Hand-built, dependency-free SVG/HTML charts for the Stats tab.
   Single-series magnitude/time bars: one brand hue (green) with an amber
   accent that is always labelled (goal line, highlighted day) so meaning is
   never colour-alone. Text uses ink tokens via CSS classes in styles.css.
*/

const Charts = (() => {
  const DAY = 86400000;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const emptyMsg = t => `<p class="chart-empty">${t}</p>`;

  const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const monthKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  // date-string → total calories that day
  function dailyTotalsMap(history) {
    const m = {};
    history.forEach(e => { const k = dayKey(new Date(e.time)); m[k] = (m[k] || 0) + (e.calories || 0); });
    return m;
  }
  // [{date: midnight Date, total}]
  function dailyTotalsList(history) {
    const m = {};
    history.forEach(e => {
      const d = new Date(e.time);
      const k = dayKey(d);
      if (!m[k]) m[k] = { date: new Date(d.getFullYear(), d.getMonth(), d.getDate()), total: 0 };
      m[k].total += (e.calories || 0);
    });
    return Object.values(m);
  }

  // Vertical bar chart. bars: [{label, value, hi?, valueLabel?}]
  function vbars(bars, opts = {}) {
    const W = 320, H = 152, padL = 8, padR = 10, padT = 16, padB = 22;
    const n = bars.length || 1;
    const goal = opts.goal || 0;
    const maxV = Math.max(1, goal, ...bars.map(b => b.value));
    const top = maxV * 1.12;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const slot = plotW / n;
    const barW = Math.min(26, slot * 0.62);
    const xOf = i => padL + slot * i + (slot - barW) / 2;
    const yOf = v => padT + plotH * (1 - v / top);
    const baseY = padT + plotH;

    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.aria || "bar chart")}">`;
    if (goal) {
      const gy = yOf(goal).toFixed(1);
      s += `<line class="chart-goal" x1="${padL}" y1="${gy}" x2="${W - padR}" y2="${gy}"/>`;
      s += `<text class="chart-label" x="${W - padR}" y="${(yOf(goal) - 3).toFixed(1)}" text-anchor="end">goal</text>`;
    }
    s += `<line class="chart-axis" x1="${padL}" y1="${baseY}" x2="${W - padR}" y2="${baseY}"/>`;
    bars.forEach((b, i) => {
      const bx = xOf(i), by = yOf(b.value), h = Math.max(0, baseY - by);
      if (b.value > 0) s += `<rect class="chart-bar${b.hi ? " hi" : ""}" x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="3"/>`;
      if (b.valueLabel) s += `<text class="chart-val" x="${(bx + barW / 2).toFixed(1)}" y="${(by - 3).toFixed(1)}" text-anchor="middle">${esc(b.valueLabel)}</text>`;
      const showLabel = opts.labelEvery ? (i % opts.labelEvery === 0 || i === n - 1) : true;
      if (b.label && showLabel) s += `<text class="chart-label" x="${(bx + barW / 2).toFixed(1)}" y="${(baseY + 12).toFixed(1)}" text-anchor="middle">${esc(b.label)}</text>`;
    });
    return s + `</svg>`;
  }

  function lastMonthsBars(history) {
    const now = new Date();
    const byMonth = {};
    history.forEach(e => { byMonth[monthKey(new Date(e.time))] = (byMonth[monthKey(new Date(e.time))] || 0) + (e.calories || 0); });
    const bars = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      bars.push({ label: d.toLocaleDateString([], { month: "short" }), value: Math.round(byMonth[monthKey(d)] || 0) });
    }
    return bars;
  }

  /* ---- public charts ---- */

  // Calories over time: daily bars (last 14d) with a daily-goal line;
  // auto-switches to monthly totals once history spans > 60 days.
  function caloriesOverTime(history, goal) {
    if (!history.length) return emptyMsg("Log a few meals to see your calorie trend over time.");
    const oldest = Math.min(...history.map(e => e.time));
    if ((Date.now() - oldest) / DAY > 60) {
      return vbars(lastMonthsBars(history), { aria: "Calories per month", labelEvery: 1 });
    }
    const totals = dailyTotalsMap(history);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const bars = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      bars.push({ label: String(d.getDate()), value: Math.round(totals[dayKey(d)] || 0) });
    }
    return vbars(bars, { goal, aria: "Calories per day for the last 14 days", labelEvery: 2 });
  }

  // Average calories per weekday (Mon–Sun); highest day highlighted + labelled.
  function weekdayAverages(history) {
    if (history.length < 2) return emptyMsg("Not enough data yet — keep logging to spot weekday patterns.");
    const totals = dailyTotalsList(history);
    const sums = Array(7).fill(0), counts = Array(7).fill(0);
    totals.forEach(t => { const wd = (t.date.getDay() + 6) % 7; sums[wd] += t.total; counts[wd]++; });
    const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const avgs = sums.map((s, i) => counts[i] ? Math.round(s / counts[i]) : 0);
    const maxV = Math.max(...avgs);
    const bars = avgs.map((v, i) => ({ label: names[i], value: v, hi: v === maxV && v > 0, valueLabel: v ? String(v) : "" }));
    return vbars(bars, { aria: "Average calories by day of week" });
  }

  // Horizontal magnitude bars of calories grouped by keyFn(entry), for the range.
  function breakdownBy(entries, keyFn) {
    if (!entries || !entries.length) return emptyMsg("No meals logged in this range.");
    const by = {};
    entries.forEach(e => { const c = keyFn(e) || "Other"; by[c] = (by[c] || 0) + (e.calories || 0); });
    const rows = Object.entries(by).sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...rows.map(r => r[1]));
    return rows.map(([name, val]) =>
      `<div class="catbar">
         <span class="catbar-name">${esc(name)}</span>
         <div class="catbar-track"><div class="catbar-fill" style="width:${Math.max(4, val / max * 100).toFixed(0)}%"></div></div>
         <span class="catbar-val">${Math.round(val)}</span>
       </div>`
    ).join("");
  }

  // One-line takeaways: usual highest day + week-over-week direction.
  function insights(history) {
    if (history.length < 3) return "Log a few more meals — your best/worst days and weekly trend will appear here.";
    const totals = dailyTotalsList(history);
    const sums = Array(7).fill(0), counts = Array(7).fill(0);
    totals.forEach(t => { const wd = (t.date.getDay() + 6) % 7; sums[wd] += t.total; counts[wd]++; });
    const names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    let hiDay = -1, hiAvg = -1;
    sums.forEach((s, i) => { if (counts[i]) { const a = s / counts[i]; if (a > hiAvg) { hiAvg = a; hiDay = i; } } });

    const now = Date.now();
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    const dow = (startToday.getDay() + 6) % 7;
    const weekStart = new Date(startToday); weekStart.setDate(weekStart.getDate() - dow);
    const lastWeekStart = new Date(weekStart); lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const sum = (from, to) => history.filter(e => e.time >= from && e.time < to).reduce((a, e) => a + (e.calories || 0), 0);
    const thisWk = sum(weekStart.getTime(), now + 1);
    const lastWk = sum(lastWeekStart.getTime(), weekStart.getTime());

    const parts = [];
    if (hiDay >= 0) parts.push(`Your highest-calorie day is usually <strong>${names[hiDay]}</strong> (~${Math.round(hiAvg)} kcal).`);
    if (lastWk > 0) {
      const diff = Math.round((thisWk - lastWk) / lastWk * 100);
      parts.push(`This week is running <strong>${Math.abs(diff)}% ${diff <= 0 ? "lower" : "higher"}</strong> than last week.`);
    }
    return parts.join(" ") || "Keep logging to reveal your trends.";
  }

  return { caloriesOverTime, weekdayAverages, breakdownBy, insights };
})();
