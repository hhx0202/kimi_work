// 静态守护：几条容易在重构中丢掉的页面约束（读源码/样式断言）
const fs = require('fs');
const path = require('path');
const { ok, section, DB_SRC } = require('./harness');

const ROOT = path.join(__dirname, '..');
const CSS = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

module.exports = async function run() {
  section('「我的」页明细列表：超高后内部滚动');
  ok(/\.log-list\s*\{[^}]*max-height:\s*340px/.test(CSS), '.log-list 有固定最大高度');
  ok(/\.log-list\s*\{[^}]*overflow-y:\s*auto/.test(CSS), '.log-list 内部可滚动');
  ok(!/\.log-list\s*\{[^}]*overflow:\s*hidden/.test(CSS), '没有再把滚动裁掉的 overflow:hidden');

  section('CDN 脚本带 crossorigin（否则报错只有 "Script error."）');
  for (const u of ['@supabase/supabase-js@2', 'canvas-confetti', 'html2canvas']) {
    ok(new RegExp(`<script[^>]*crossorigin="anonymous"[^>]*${u.replace(/[/@.]/g, m => '\\' + m)}`).test(HTML)
      || (HTML.includes('crossorigin="anonymous"') && HTML.includes(u)), `${u} 带 crossorigin`);
  }

  section('Supabase 客户端关掉未使用的 Auth（避免切回前台时恢复会话报错）');
  ok(DB_SRC.includes('persistSession: false'), 'persistSession: false');
  ok(DB_SRC.includes('autoRefreshToken: false'), 'autoRefreshToken: false');
  ok(DB_SRC.includes('detectSessionInUrl: false'), 'detectSessionInUrl: false');

  section('宝可梦排序按钮存在');
  const APP = require('./harness').APP_SRC;
  ok(APP.includes('data-action="pm-sort"'), '页面上有排序按钮');
  ok(APP.includes("act === 'pm-sort'"), '按钮有事件处理');
  ok(APP.includes("sharedSet('pm_sort'"), '排序选择会跨设备同步');
};
