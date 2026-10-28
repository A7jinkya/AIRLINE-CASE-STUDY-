/* Tiny dependency-free SVG charts. Exposes window.Charts. */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const tip = () => document.getElementById("tooltip");

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(parent, x, y, str, attrs) {
    const t = el("text", Object.assign({ x, y }, attrs || {}), parent);
    t.textContent = str;
    return t;
  }
  function hover(node, msg) {
    node.addEventListener("mousemove", (ev) => {
      const t = tip();
      t.textContent = msg; t.hidden = false;
      t.style.left = Math.min(ev.clientX + 12, window.innerWidth - t.offsetWidth - 8) + "px";
      t.style.top = ev.clientY + 14 + "px";
    });
    node.addEventListener("mouseleave", () => { tip().hidden = true; });
  }
  function svg(container, w, h) {
    container.innerHTML = "";
    const s = el("svg", { viewBox: `0 0 ${w} ${h}`, width: "100%", role: "img" });
    s.style.display = "block";
    container.appendChild(s);
    return s;
  }
  function legend(container, items) {
    const d = document.createElement("div");
    d.className = "legend";
    d.innerHTML = items.map((i) => `<span><i style="background:${i.color}"></i>${i.name}</span>`).join("");
    container.appendChild(d);
  }
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  function niceMax(v) {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const f = v / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
  }

  /* Vertical stacked / simple bars. opts: {labels, series:[{name,color,values}], percent, height, yFmt} */
  function bars(container, o) {
    const W = 560, H = o.height || 260, m = { l: 48, r: 10, t: 10, b: 46 };
    const s = svg(container, W, H);
    const n = o.labels.length;
    const totals = o.labels.map((_, i) => o.series.reduce((a, se) => a + se.values[i], 0));
    const max = o.percent ? 100 : niceMax(Math.max(...totals, 1));
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    for (let g = 0; g <= 4; g++) {
      const y = m.t + ih - (g / 4) * ih;
      el("line", { x1: m.l, x2: W - m.r, y1: y, y2: y, class: "axis" }, s);
      const v = (g / 4) * max;
      text(s, m.l - 6, y + 4, o.percent ? v + "%" : (o.yFmt || fmt)(v), { "text-anchor": "end" });
    }
    const bw = iw / n;
    o.labels.forEach((lab, i) => {
      let acc = 0;
      const x = m.l + i * bw + bw * 0.14, w = bw * 0.72;
      o.series.forEach((se) => {
        const raw = se.values[i];
        const val = o.percent ? (totals[i] ? (raw / totals[i]) * 100 : 0) : raw;
        const h = (val / max) * ih;
        const y = m.t + ih - ((acc + val) / max) * ih;
        const r = el("rect", { x, y, width: w, height: Math.max(h, 0), fill: se.color, rx: 2 }, s);
        hover(r, `${lab}\n${se.name}: ${fmt(raw)}${o.percent ? ` (${val.toFixed(1)}%)` : ""}`);
        acc += val;
      });
      const t = text(s, x + w / 2, H - m.b + 14, lab, { "text-anchor": n > 6 ? "end" : "middle" });
      if (n > 6) t.setAttribute("transform", `rotate(-35 ${x + w / 2} ${H - m.b + 14})`);
    });
    if (o.series.length > 1 || o.legend) legend(container, o.series.map((se) => ({ name: se.name, color: se.color })));
  }

  /* Horizontal bars. opts: {labels, values, color, valueLabels} */
  function hbars(container, o) {
    const rowH = 24, W = 560, m = { l: 130, r: 60, t: 4, b: 4 };
    const H = o.labels.length * rowH + m.t + m.b;
    const s = svg(container, W, H);
    const max = Math.max(...o.values, 1);
    o.labels.forEach((lab, i) => {
      const y = m.t + i * rowH;
      const w = ((W - m.l - m.r) * o.values[i]) / max;
      text(s, m.l - 8, y + 15, lab.length > 20 ? lab.slice(0, 19) + "…" : lab, { "text-anchor": "end" });
      const r = el("rect", { x: m.l, y: y + 3, width: w, height: rowH - 8, fill: o.color || "var(--bar)", rx: 3 }, s);
      hover(r, `${lab}: ${fmt(o.values[i])}`);
      text(s, m.l + w + 6, y + 15, fmt(o.values[i]), {});
    });
  }

  /* Line chart. opts: {labels, series:[{name,color,values,width,dash}], xTicks:[idx...], tickLabel(i), yMin, yMax} */
  function lines(container, o) {
    const W = 560, H = o.height || 240, m = { l: 48, r: 12, t: 10, b: 28 };
    const s = svg(container, W, H);
    const all = o.series.flatMap((se) => se.values.filter((v) => v != null));
    const yMin = o.yMin != null ? o.yMin : 0;
    const yMax = o.yMax != null ? o.yMax : niceMax(Math.max(...all, 1));
    const n = o.labels.length, iw = W - m.l - m.r, ih = H - m.t - m.b;
    const X = (i) => m.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
    const Y = (v) => m.t + ih - ((v - yMin) / (yMax - yMin || 1)) * ih;
    for (let g = 0; g <= 4; g++) {
      const v = yMin + (g / 4) * (yMax - yMin), y = Y(v);
      el("line", { x1: m.l, x2: W - m.r, y1: y, y2: y, class: "axis" }, s);
      text(s, m.l - 6, y + 4, (o.yFmt || fmt)(v), { "text-anchor": "end" });
    }
    (o.xTicks || []).forEach((i) => text(s, X(i), H - 8, o.tickLabel ? o.tickLabel(i) : o.labels[i], { "text-anchor": "middle" }));
    o.series.forEach((se) => {
      let d = "";
      se.values.forEach((v, i) => { if (v != null) d += (d ? "L" : "M") + X(i).toFixed(1) + "," + Y(v).toFixed(1); });
      el("path", { d, fill: "none", stroke: se.color, "stroke-width": se.width || 2, "stroke-dasharray": se.dash || "", "stroke-linejoin": "round" }, s);
    });
    // hover capture
    const overlay = el("rect", { x: m.l, y: m.t, width: iw, height: ih, fill: "transparent" }, s);
    overlay.addEventListener("mousemove", (ev) => {
      const r = overlay.getBoundingClientRect();
      const i = Math.max(0, Math.min(n - 1, Math.round(((ev.clientX - r.left) / r.width) * (n - 1))));
      const t = tip();
      t.textContent = o.labels[i] + "\n" + o.series.map((se) => `${se.name}: ${se.values[i] == null ? "–" : (o.tipFmt || fmt)(se.values[i])}`).join("\n");
      t.hidden = false;
      t.style.left = Math.min(ev.clientX + 12, window.innerWidth - t.offsetWidth - 8) + "px";
      t.style.top = ev.clientY + 14 + "px";
    });
    overlay.addEventListener("mouseleave", () => { tip().hidden = true; });
    if (o.series.length > 1) legend(container, o.series.map((se) => ({ name: se.name, color: se.color })));
  }

  /* Donut. opts: {labels, values, colors} */
  function donut(container, o) {
    const S = 220, c = S / 2, R = 90, r = 56;
    const s = svg(container, S, S);
    s.style.maxWidth = "240px"; s.style.margin = "0 auto";
    const total = o.values.reduce((a, b) => a + b, 0) || 1;
    let a0 = -Math.PI / 2;
    o.values.forEach((v, i) => {
      if (!v) return;
      const frac = v / total, a1 = a0 + frac * 2 * Math.PI - (frac === 1 ? 0.0001 : 0);
      const p = (rad, ang) => `${(c + rad * Math.cos(ang)).toFixed(2)},${(c + rad * Math.sin(ang)).toFixed(2)}`;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const d = `M${p(R, a0)} A${R},${R} 0 ${large} 1 ${p(R, a1)} L${p(r, a1)} A${r},${r} 0 ${large} 0 ${p(r, a0)} Z`;
      const path = el("path", { d, fill: o.colors[i] }, s);
      hover(path, `${o.labels[i]}: ${fmt(v)} (${(frac * 100).toFixed(1)}%)`);
      a0 = a1;
    });
    text(s, c, c + 2, fmt(total), { "text-anchor": "middle", class: "lbl-strong", style: "font-size:18px" });
    text(s, c, c + 18, "passengers", { "text-anchor": "middle" });
    legend(container, o.labels.map((l, i) => ({ name: l, color: o.colors[i] })));
  }

  /* Combo: bars for counts + line for rate (right axis). opts: {labels, bars, rate, color} */
  function combo(container, o) {
    const W = 560, H = 250, m = { l: 48, r: 44, t: 10, b: 28 };
    const s = svg(container, W, H);
    const n = o.labels.length, iw = W - m.l - m.r, ih = H - m.t - m.b;
    const bMax = niceMax(Math.max(...o.bars, 1));
    const rMin = Math.floor(Math.min(...o.rate.filter((v) => v != null), 100) / 5) * 5 - 5;
    const rMax = Math.min(100, Math.ceil(Math.max(...o.rate.filter((v) => v != null), 0) / 5) * 5 + 5);
    const bw = iw / n;
    for (let g = 0; g <= 4; g++) {
      const y = m.t + ih - (g / 4) * ih;
      el("line", { x1: m.l, x2: W - m.r, y1: y, y2: y, class: "axis" }, s);
      text(s, m.l - 6, y + 4, fmt((g / 4) * bMax), { "text-anchor": "end" });
      text(s, W - m.r + 6, y + 4, (rMin + (g / 4) * (rMax - rMin)).toFixed(0) + "%", {});
    }
    const pts = [];
    o.labels.forEach((lab, i) => {
      const h = (o.bars[i] / bMax) * ih, x = m.l + i * bw + bw * 0.15;
      const r = el("rect", { x, y: m.t + ih - h, width: bw * 0.7, height: h, fill: "var(--bar)", opacity: 0.8, rx: 2 }, s);
      hover(r, `${lab}\nPassengers: ${fmt(o.bars[i])}\nDisrupted: ${o.rate[i] == null ? "–" : o.rate[i].toFixed(1) + "%"}`);
      text(s, x + bw * 0.35, H - 8, lab, { "text-anchor": "middle" });
      if (o.rate[i] != null) pts.push([m.l + i * bw + bw / 2, m.t + ih - ((o.rate[i] - rMin) / (rMax - rMin || 1)) * ih]);
    });
    el("path", { d: pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(""), fill: "none", stroke: "var(--cancelled)", "stroke-width": 2.2 }, s);
    pts.forEach((p) => el("circle", { cx: p[0], cy: p[1], r: 3, fill: "var(--cancelled)" }, s));
    legend(container, [{ name: "Passengers (left)", color: "var(--bar)" }, { name: "% delayed or cancelled (right)", color: "var(--cancelled)" }]);
  }

  window.Charts = { bars, hbars, lines, donut, combo, fmt };
})();
