// GET /api/passengers?q=&status=&continent=&gender=&country=&page=1&pageSize=25
// Serverless function (Node). Data is loaded once per warm instance.
const fs = require("fs");
const path = require("path");

let DB = null;
function load() {
  if (DB) return DB;
  const candidates = [
    path.join(process.cwd(), "data", "passengers.json"),
    path.join(__dirname, "..", "data", "passengers.json"),
  ];
  const file = candidates.find((p) => fs.existsSync(p));
  if (!file) throw new Error("passengers.json not found");
  DB = JSON.parse(fs.readFileSync(file, "utf8"));
  // pre-lowercase searchable text once
  DB.search = DB.base.map((r) => (r[0] + " " + r[1] + " " + r[2] + " " + r[5]).toLowerCase());
  return DB;
}

module.exports = (req, res) => {
  try {
    const db = load();
    const url = new URL(req.url, "http://localhost");
    const p = url.searchParams;
    const q = (p.get("q") || "").trim().toLowerCase();
    const status = p.get("status") || "";
    const continent = p.get("continent") || "";
    const gender = p.get("gender") || "";
    const country = (p.get("country") || "").trim().toLowerCase();
    const pageSize = Math.min(Math.max(parseInt(p.get("pageSize")) || 25, 1), 100);
    let page = Math.max(parseInt(p.get("page")) || 1, 1);

    const stIdx = status ? db.status.indexOf(status) : -1;
    const coIdx = continent ? db.dicts.continent.indexOf(continent) : -1;
    const gIdx = gender ? db.dicts.gender.indexOf(gender) : -1;
    if ((status && stIdx < 0) || (continent && coIdx < 0) || (gender && gIdx < 0)) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ error: "Invalid filter value" }));
    }
    const countryIdxs = new Set();
    if (country) db.dicts.country.forEach((c, i) => { if (c.toLowerCase().includes(country)) countryIdxs.add(i); });

    const matches = [];
    const n = db.base.length;
    for (let i = 0; i < n; i++) {
      if (stIdx >= 0 && db.st[i] !== stIdx) continue;
      if (coIdx >= 0 && db.co[i] !== coIdx) continue;
      if (gIdx >= 0 && db.g[i] !== gIdx) continue;
      if (country && !countryIdxs.has(db.ct[i])) continue;
      if (q && !db.search[i].includes(q)) continue;
      matches.push(i);
    }
    const total = matches.length;
    const pages = Math.max(Math.ceil(total / pageSize), 1);
    if (page > pages) page = pages;
    const rows = matches.slice((page - 1) * pageSize, page * pageSize).map((i) => {
      const b = db.base[i];
      return {
        id: b[0], firstName: b[1], lastName: b[2], gender: db.dicts.gender[db.g[i]], age: b[3],
        nationality: db.dicts.nationality[db.nat[i]], airport: db.dicts.airport[db.ap[i]],
        country: db.dicts.country[db.ct[i]], continent: db.dicts.continent[db.co[i]],
        date: b[4], arrival: db.dicts.arrival[db.ar[i]] || null, pilot: b[5], status: db.status[db.st[i]],
      };
    });
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ total, page, pages, pageSize, rows }));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: String(e.message || e) }));
  }
};
