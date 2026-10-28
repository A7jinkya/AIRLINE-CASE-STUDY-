// Smoke tests: node scripts/test.js
const assert = require("assert"), fs = require("fs"), path = require("path");
const handler = require("../api/passengers.js");
function call(qs) {
  return new Promise((resolve) => {
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { resolve({ status: this.statusCode, body: JSON.parse(b) }); } };
    handler({ url: "/api/passengers?" + qs }, res);
  });
}
(async () => {
  const cube = JSON.parse(fs.readFileSync(path.join(__dirname, "../public/data/cube.json")));
  const total = cube.cube.reduce((a, r) => a + r[5], 0);
  assert.strictEqual(total, cube.meta.rows, "cube totals match row count");
  let r = await call("");
  assert.strictEqual(r.status, 200); assert.strictEqual(r.body.total, cube.meta.rows); assert.strictEqual(r.body.rows.length, 25);
  const sum = [];
  for (const s of cube.status) sum.push((await call("status=" + encodeURIComponent(s))).body.total);
  assert.strictEqual(sum.reduce((a, b) => a + b, 0), cube.meta.rows, "status filters partition the data");
  r = await call("q=" + encodeURIComponent(r.body.rows[0].lastName));
  assert.ok(r.body.total >= 1, "search by last name");
  r = await call("status=Bogus"); assert.strictEqual(r.status, 400);
  r = await call("page=99999&pageSize=1000"); assert.ok(r.body.rows.length <= 100 && r.body.page === r.body.pages);
  console.log("all tests passed; rows =", total);
})().catch((e) => { console.error(e); process.exit(1); });
