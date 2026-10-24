// 跑全部用例：node tests/run.js
const fs = require('fs');
const path = require('path');
const { summary } = require('./harness');

(async () => {
  const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort();
  for (const f of files) {
    console.log(`\n=== ${f} ===`);
    const mod = require(path.join(__dirname, f));
    await mod();
    if (typeof mod.walletChecks === 'function') mod.walletChecks();
  }
  const s = summary();
  console.log(`\n${'='.repeat(40)}\n合计 ${s.pass} 通过 / ${s.fail} 失败\n`);
  process.exit(s.fail ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
