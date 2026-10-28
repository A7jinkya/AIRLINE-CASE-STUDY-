(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const fmt = Charts.fmt;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const SC = ["var(--ontime)", "var(--delayed)", "var(--cancelled)"];
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let D = null;

  /* ---------- boot ---------- */
  fetch("data/cube.json")
    .then((r) => { if (!r.ok) throw new Error("Could not load data (" + r.status + ")"); return r.json(); })
    .then((d) => { D = d; init(); })
    .catch((e) => { $("loading").hidden = true; $("error").hidden = false; $("error").textContent = e.message; });

  function init() {
    $("loading").hidden = true;
    fillSelect($("f-continent"), ["All"].concat(D.continents));
    fillSelect($("f-gender"), ["All"].concat(D.genders));
    fillSelect($("f-age"), ["All"].concat(D.ageGroups));
    fillSelect($("f-month"), ["All"].concat(MONTHS));
    ["f-continent", "f-gender", "f-age", "f-month"].forEach((id) => $(id).addEventListener("change", renderDashboard));
    $("f-reset").addEventListener("click", () => {
      ["f-continent", "f-gender", "f-age", "f-month"].forEach((id) => ($(id).selectedIndex = 0));
      renderDashboard();
    });
    document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
    window.addEventListener("hashchange", () => showTab(location.hash.slice(1) || "dashboard", true));

    $("a-rows").textContent = fmt(D.meta.rows);
    $("a-dates").textContent = D.meta.dateMin + " to " + D.meta.dateMax;
    $("a-ap").textContent = fmt(D.meta.airports);
    $("a-co").textContent = D.meta.countries;

    initExplorer();
    initPassengers();
    showTab(location.hash.slice(1) || "dashboard", true);
  }

  function fillSelect(sel, items) {
    sel.innerHTML = items.map((v, i) => `<option value="${i === 0 ? "" : esc(v)}">${esc(v)}</option>`).join("");
  }

  const rendered = {};
  function showTab(name, fromHash) {
    if (!["dashboard", "explorer", "passengers", "about"].includes(name)) name = "dashboard";
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
    document.querySelectorAll(".panel").forEach((p) => (p.hidden = p.id !== "tab-" + name));
    if (!fromHash) history.replaceState(null, "", "#" + name);
    if (name === "dashboard") renderDashboard();
    if (name === "passengers" && !rendered.passengers) { rendered.passengers = true; loadPassengers(); }
  }

  /* ---------- dashboard ---------- */
  function renderDashboard() {
    const fc = $("f-continent").value, fg = $("f-gender").value, fa = $("f-age").value, fm = $("f-month").value;
    const ci = fc ? D.continents.indexOf(fc) : -1, gi = fg ? D.genders.indexOf(fg) : -1;
    const ai = fa ? D.ageGroups.indexOf(fa) : -1, mi = fm ? MONTHS.indexOf(fm) : -1;

    const status = [0, 0, 0];
    const byCont = D.continents.map(() => [0, 0, 0]);
    const byMonth = MONTHS.map(() => [0, 0, 0]);
    const byAge = D.ageGroups.map(() => [0, 0, 0]);
    for (const [c, g, a, m, s, n] of D.cube) {
      if (gi >= 0 && g !== gi) continue;
      // each chart ignores its own dimension filter so that it can still show the comparison
      const okC = ci < 0 || c === ci, okA = ai < 0 || a === ai, okM = mi < 0 || m === mi;
      if (okC && okA && okM) status[s] += n;
      if (okA && okM) byCont[c][s] += n;
      if (okC && okA) byMonth[m][s] += n;
      if (okC && okM) byAge[a][s] += n;
    }
    const total = status[0] + status[1] + status[2];
    const pct = (v) => (total ? ((v / total) * 100).toFixed(1) + "%" : "–");
    $("kpis").innerHTML = [
      ["", "Passengers", fmt(total), total ? ((total / D.meta.rows) * 100).toFixed(1) + "% of all records" : "No matching records"],
      ["ontime", "On time", pct(status[0]), fmt(status[0]) + " passengers"],
      ["delayed", "Delayed", pct(status[1]), fmt(status[1]) + " passengers"],
      ["cancelled", "Cancelled", pct(status[2]), fmt(status[2]) + " passengers"],
      ["", "Disruption rate", pct(status[1] + status[2]), "Delayed + cancelled"],
    ].map(([c, l, v, s]) => `<div class="kpi ${c}"><div class="label">${l}</div><div class="value">${v}</div><div class="sub">${s}</div></div>`).join("");

    Charts.donut($("c-status"), { labels: D.status, values: status, colors: SC });

    const series = (rows) => D.status.map((name, s) => ({ name, color: SC[s], values: rows.map((r) => r[s]) }));
    Charts.bars($("c-continent"), { labels: D.continents, series: series(byCont), percent: true });
    Charts.bars($("c-age"), { labels: D.ageGroups, series: series(byAge), percent: true });
    const rate = byMonth.map((r) => { const t = r[0] + r[1] + r[2]; return t ? ((r[1] + r[2]) / t) * 100 : null; });
    Charts.combo($("c-month"), { labels: MONTHS, bars: byMonth.map((r) => r[0] + r[1] + r[2]), rate });

    // static charts (draw once)
    if (!renderDashboard.done) {
      renderDashboard.done = true;
      const dl = D.daily.dates, tot = D.daily.counts.map((r) => r[0] + r[1] + r[2]);
      const avg = tot.map((_, i) => (i < 6 ? null : tot.slice(i - 6, i + 1).reduce((a, b) => a + b, 0) / 7));
      const ticks = []; dl.forEach((d, i) => { if (d.endsWith("-01") && i % 1 === 0) ticks.push(i); });
      Charts.lines($("c-daily"), {
        labels: dl, xTicks: ticks.filter((_, i) => i % 2 === 0), tickLabel: (i) => MONTHS[+dl[i].slice(5, 7) - 1],
        series: [{ name: "Daily", color: "#9db7d6", values: tot, width: 1 }, { name: "7-day average", color: "#1f4e79", values: avg, width: 2.2 }],
        yMin: 0, tipFmt: (v) => v.toFixed(0),
      });
      const h = D.ageHist, groups = [];
      for (let a = 1; a <= 90; a += 5) groups.push(h.slice(a - 1, a + 4).reduce((x, y) => x + y, 0));
      Charts.bars($("c-hist"), {
        labels: groups.map((_, i) => `${1 + i * 5}-${5 + i * 5}`), legend: false,
        series: [{ name: "Passengers", color: "#3b6ea8", values: groups }],
      });
    }

    // data-driven caveat
    const rates = byCont.map((r) => { const t = r[0] + r[1] + r[2]; return t ? ((r[1] + r[2]) / t) * 100 : null; }).filter((v) => v != null);
    $("insight").textContent = rates.length > 1
      ? `Across continents, the disruption rate ranges from ${Math.min(...rates).toFixed(1)}% to ${Math.max(...rates).toFixed(1)}% for the current filters. ` +
        "Spreads this small are typical of random variation, not a real regional effect."
      : "";
  }

  /* ---------- explorer ---------- */
  function initExplorer() {
    sortable($("ex-country"), $("ex-country-q"), ["Country", "Continent", "Passengers", "On time", "Delayed", "Cancelled", "Disrupted %"],
      D.countries.map((r) => rowStats(r[0], r[1], r[2], r[3], r[4])), 2);
    sortable($("ex-nat"), $("ex-nat-q"), ["Nationality", "Passengers", "On time", "Delayed", "Cancelled", "Disrupted %"],
      D.nationalities.map((r) => rowStats(r[0], null, r[1], r[2], r[3])), 1);
  }
  function rowStats(name, cont, a, b, c) {
    const t = a + b + c;
    const r = [name]; if (cont != null) r.push(cont);
    return r.concat([t, a, b, c, t ? ((b + c) / t) * 100 : 0]);
  }
  function sortable(table, search, headers, rows, defaultCol) {
    let col = defaultCol, dir = -1, q = "";
    function draw() {
      const f = rows.filter((r) => !q || String(r[0]).toLowerCase().includes(q));
      f.sort((x, y) => (typeof x[col] === "string" ? x[col].localeCompare(y[col]) : x[col] - y[col]) * dir);
      const text = (v, i) => (typeof v === "number" ? (i === headers.length - 1 ? v.toFixed(1) + "%" : fmt(v)) : esc(v));
      table.innerHTML = "<thead><tr>" + headers.map((h, i) => `<th data-i="${i}" class="${typeof rows[0][i] === "number" ? "num" : ""}">${h}${i === col ? (dir === 1 ? " ▲" : " ▼") : ""}</th>`).join("") +
        "</tr></thead><tbody>" + f.map((r) => "<tr>" + r.map((v, i) => `<td class="${typeof v === "number" ? "num" : ""}">${text(v, i)}</td>`).join("") + "</tr>").join("") + "</tbody>";
      table.querySelectorAll("th").forEach((th) => th.addEventListener("click", () => {
        const i = +th.dataset.i; if (i === col) dir = -dir; else { col = i; dir = typeof rows[0][i] === "string" ? 1 : -1; } draw();
      }));
    }
    search.addEventListener("input", () => { q = search.value.trim().toLowerCase(); draw(); });
    draw();
  }

  /* ---------- passengers (API) ---------- */
  const P = { page: 1, pages: 1, timer: null, seq: 0 };
  function initPassengers() {
    fillSelect($("p-status"), ["All"].concat(D.status));
    fillSelect($("p-continent"), ["All"].concat(D.continents));
    fillSelect($("p-gender"), ["All"].concat(D.genders));
    ["p-status", "p-continent", "p-gender"].forEach((id) => $(id).addEventListener("change", () => { P.page = 1; loadPassengers(); }));
    ["p-q", "p-country"].forEach((id) => $(id).addEventListener("input", () => {
      clearTimeout(P.timer); P.timer = setTimeout(() => { P.page = 1; loadPassengers(); }, 350);
    }));
    $("p-reset").addEventListener("click", () => {
      $("p-q").value = ""; $("p-country").value = "";
      ["p-status", "p-continent", "p-gender"].forEach((id) => ($(id).selectedIndex = 0));
      P.page = 1; loadPassengers();
    });
    $("p-prev").addEventListener("click", () => { if (P.page > 1) { P.page--; loadPassengers(); } });
    $("p-next").addEventListener("click", () => { if (P.page < P.pages) { P.page++; loadPassengers(); } });
  }
  function loadPassengers() {
    const params = new URLSearchParams({
      q: $("p-q").value, status: $("p-status").value, continent: $("p-continent").value,
      gender: $("p-gender").value, country: $("p-country").value, page: P.page, pageSize: 25,
    });
    const seq = ++P.seq;
    $("p-count").textContent = "Loading…";
    fetch("/api/passengers?" + params)
      .then((r) => r.json().then((j) => { if (!r.ok) throw new Error(j.error || r.status); return j; }))
      .then((j) => {
        if (seq !== P.seq) return;
        P.page = j.page; P.pages = j.pages;
        $("p-count").textContent = fmt(j.total) + " passengers";
        $("p-page").textContent = `Page ${j.page} of ${fmt(j.pages)}`;
        $("p-prev").disabled = j.page <= 1; $("p-next").disabled = j.page >= j.pages;
        const head = ["ID", "Name", "Gender", "Age", "Nationality", "Departure airport", "Country", "Date", "Arrival", "Pilot", "Status"];
        $("p-table").innerHTML = "<thead><tr>" + head.map((h) => `<th>${h}</th>`).join("") + "</tr></thead><tbody>" +
          j.rows.map((r) => `<tr><td>${esc(r.id)}</td><td>${esc(r.firstName + " " + r.lastName)}</td><td>${esc(r.gender)}</td><td class="num">${r.age}</td>` +
            `<td>${esc(r.nationality)}</td><td>${esc(r.airport)}</td><td>${esc(r.country)}</td><td>${esc(r.date)}</td><td>${esc(r.arrival || "–")}</td>` +
            `<td>${esc(r.pilot)}</td><td><span class="badge s${D.status.indexOf(r.status)}">${esc(r.status)}</span></td></tr>`).join("") + "</tbody>";
      })
      .catch((e) => {
        if (seq !== P.seq) return;
        $("p-count").textContent = "Could not load passengers: " + e.message + " (the /api endpoint only runs on Vercel or `vercel dev`)";
      });
  }
})();
