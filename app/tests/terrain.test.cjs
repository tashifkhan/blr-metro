const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const overview = JSON.parse(fs.readFileSync('src/data/terrain.json', 'utf8'));
const detail = JSON.parse(fs.readFileSync('src/data/terrainDetail.json', 'utf8'));

function evaluate(path) {
  const exports = {};
  const source = fs.readFileSync(path, 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const requireFn = (name) => {
    if (name.endsWith('terrain.json')) return overview;
    if (name.endsWith('terrainDetail.json')) return detail;
    throw new Error(`unexpected require ${name}`);
  };
  vm.runInNewContext(code, { exports, require: requireFn, Promise });
  return exports;
}

const terrain = evaluate('src/components/map/terrain.ts');

test('the overview has contours, water and two high-ground bands', () => {
  assert.ok(overview.minor.startsWith('M'));
  assert.ok(overview.major.startsWith('M'));
  assert.ok(overview.water.length > 0);
  assert.equal(overview.high.length, 2);
});

test('overview culling keeps whole paths in source order, including at the network scale', () => {
  const whole = terrain.overviewForView({ x0: -1e6, y0: -1e6, x1: 1e6, y1: 1e6 }, 0);
  for (const key of ['minor', 'major', 'water', 'rivers']) assert.equal(whole[key], overview[key]);
  assert.deepEqual(whole.high, overview.high);

  const central = terrain.overviewForView({ x0: -12_000, y0: -18_000, x1: 12_000, y1: 18_000 }, 12);
  for (const key of ['minor', 'major', 'water', 'rivers']) {
    assert.ok(central[key].length < overview[key].length);
    const kept = new Set(central[key].match(/M[^M]+/g));
    assert.equal(overview[key].match(/M[^M]+/g).filter((part) => kept.has(part)).join(''), central[key]);
  }
});

test('detail chunks sit on the chunk grid', () => {
  assert.ok(detail.chunks.length > 0);
  for (const chunk of detail.chunks) {
    assert.equal(Math.abs(chunk.x % detail.chunkSize), 0);
    assert.equal(Math.abs(chunk.y % detail.chunkSize), 0);
  }
});

test('chunksIn returns only the chunks overlapping a view', () => {
  const size = detail.chunkSize;
  const [first] = detail.chunks;
  const inside = terrain.chunksIn(detail, first.x + 1, first.y + 1, first.x + size - 1, first.y + size - 1);
  assert.deepEqual(
    inside.map((c) => `${c.x},${c.y}`),
    [`${first.x},${first.y}`],
  );
  const nowhere = terrain.chunksIn(detail, 1e9, 1e9, 1e9 + 1, 1e9 + 1);
  assert.equal(nowhere.length, 0);
});

test('the detail layer loads once and is shared', async () => {
  const a = terrain.loadTerrainDetail();
  const b = terrain.loadTerrainDetail();
  assert.equal(a, b);
  assert.equal((await a).chunks.length, detail.chunks.length);
});
