// 静态守护：几条容易在重构中丢掉的页面约束（读源码/样式断言）
const fs = require('fs');
const path = require('path');
const { ok, section, DB_SRC } = require('./harness');

const ROOT = path.join(__dirname, '..');
const CSS = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const { APP_SRC: APP } = require('./harness');

module.exports = async function run() {
  section('「我的」页明细列表：超高后内部滚动');
  ok(/\.log-list\s*\{[^}]*max-height:\s*340px/.test(CSS), '.log-list 有固定最大高度');
  ok(/\.log-list\s*\{[^}]*overflow-y:\s*auto/.test(CSS), '.log-list 内部可滚动');
  ok(!/\.log-list\s*\{[^}]*overflow:\s*hidden/.test(CSS), '没有再把滚动裁掉的 overflow:hidden');

  section('第三方库本地自带（外链 CDN 在国内/EdgeOne 上会取不到）');
  // 教训：2026-10-22 EdgeOne Pages 部署后报「supabase is not defined」——jsdelivr 在中国大陆不可达，
  // 三个库全挂了。现在一律用仓库里的 js/vendor/，index.html 不许再出现 jsdelivr 外链。
  for (const f of ['js/vendor/supabase.js', 'js/vendor/confetti.min.js', 'js/vendor/html2canvas.min.js']) {
    ok(HTML.includes(`src="${f}`), `index.html 引用 ${f}`);   // 允许带 ?v= 版本号（升级时破缓存用）
    ok(fs.existsSync(path.join(ROOT, f)), `${f} 文件存在`);
  }
  ok(!/<(script|link)[^>]+jsdelivr/i.test(HTML), 'index.html 不再用 jsdelivr 外链（注释里说明历史可以）');
  ok(DB_SRC.includes("typeof supabase === 'undefined'"), '组件没加载时给出人话提示（不再只报 supabase is not defined）');

  section('Supabase 客户端关掉未使用的 Auth（避免切回前台时恢复会话报错）');
  ok(DB_SRC.includes('persistSession: false'), 'persistSession: false');
  ok(DB_SRC.includes('autoRefreshToken: false'), 'autoRefreshToken: false');
  ok(DB_SRC.includes('detectSessionInUrl: false'), 'detectSessionInUrl: false');

  section('错误现场信息：只有 "Script error." 时也能定位');
  // 监听必须排在任何外部脚本之前，否则脚本自己报错时没人接
  ok(HTML.indexOf('__earlyErrors') > 0 && HTML.indexOf('__earlyErrors') < HTML.indexOf('js/vendor/supabase.js'),
    '早期错误监听排在第三方库之前');
  ok(/addEventListener\('error',[\s\S]*?\}\s*,\s*true\s*\)/.test(HTML), '早期监听用 capture 才能收到资源加载失败');
  ok(APP.includes('function envSnapshot('), '有现场信息采集函数');
  for (const k of ['UA=', '页面=', '可见=', '在线=', '脚本标签=', '已加载脚本域=', '早期错误=', '页面更新于=', '就绪=', '加载后=', '导航=']) {
    ok(APP.includes(k), `现场信息包含 ${k.slice(0, -1)}`);
  }
  ok(APP.includes("window.__kmAppReady = true"), 'app 就绪后停用早期监听，避免同一条错误记两次');
  ok(HTML.includes('window.__kmAppReady'), 'index.html 的早期监听认得就绪标记');
  ok(APP.includes('切回前台后') && APP.includes('visibilityHint'), '记录是否刚从后台切回来');
  ok(APP.includes('脚本错误（跨域，无详情）'), '跨域 Script error 单独归一类，方便统计');
  ok(/extra:\s*String\(extra \|\| ''\)\.slice\(0,\s*900\)/.test(APP), 'extra 容量够放现场信息，不会被截断');
  ok(APP.includes('reportError(\n      x.res ? \'资源加载失败\''), '启动时把早期错误收进日志');

  section('宝可梦排序：按钮 + 弹层选择 + 存本机');
  ok(APP.includes('data-action="pm-sort"'), '页面上有排序按钮');
  ok(APP.includes('openPmSortPicker'), '点击打开排序选项弹层');
  ok(APP.includes('function pmSortMode(') && APP.includes('function setPmSort('), '存在排序模式读写函数');
  ok(APP.includes("lsSet(LK('pm_sort')"), '排序选择存本机 localStorage（不跨设备）');
  ok(!APP.includes("sharedSet('pm_sort'"), '排序不写共享存储');
  ok(/PM_SORT_OPTS\s*=\s*\[/.test(APP) && APP.includes("'捕获顺序'") && APP.includes("'捕获倒序'") && APP.includes("'编号顺序'") && APP.includes("'属性'"), '四个排序选项齐全');
  ok(APP.includes('class="mini-no"'), '小卡显示了图鉴编号');
  ok(/\.mini-no\s*\{/.test(CSS), '编号有对应的小字样式');

  section('闪耀卡：明显视觉 + 详情可切换造型');
  ok(APP.includes('class="art-toggle"'), '详情卡有造型切换按钮');
  ok(APP.includes("art: '🖼 立绘'") && APP.includes("sprite: '✨ 异色动图'") && APP.includes("scene: '🎴 场景卡'"), '三档造型文案齐全');
  ok(APP.includes('function cardArtSrc('), '造型选择有独立函数');
  ok(APP.includes('spritePath(pm.pokedex_no, true)'), '异色动图用 shiny 精灵');
  ok(APP.includes('assets/scenes/'), '场景卡用 assets/scenes/');
  ok(/\.ptcg-art\.sprite-art/.test(CSS), '异色动图有像素图展示样式');
  ok(/\.ptcg-art\.scene-art/.test(CSS), '场景卡有整卡展示样式');
  ok(/\.ptcg\.scene-mode \.ptcg-moves/.test(CSS) && /\.ptcg\.scene-mode \.ptcg-flavor/.test(CSS),
    '场景卡模式隐藏 App 自己的招式/图鉴介绍（卡面已印）');
  ok(!/\.ptcg\.scene-mode \.ptcg-top[\s\S]{0,40}display:\s*none/.test(CSS), '场景卡模式仍保留名字行');
  ok(/\.ptcg\.scene-mode \.ptcg-top\s*\{[^}]*margin-bottom/.test(CSS), '名字行下方留出造型按钮的空带');
  ok(/\.ptcg\.scene-mode \.ptcg-art\s*\{[^}]*aspect-ratio:\s*auto/.test(CSS), '场景卡按图片自身比例撑高（不裁切）');
  ok(/@supports not \(aspect-ratio: 1 \/ 1\)[\s\S]*\.ptcg\.scene-mode \.ptcg-art\s*\{[^}]*padding-bottom:\s*0/.test(CSS),
    'iOS 14 兜底里场景卡不套正方形 padding（否则底下多一大块空白）');
  // 场景卡不许单独设宽度/左右内边距：切换造型时整张卡宽度不变、图片不会被撑胖，比例保持素材原样
  ok(!/\.ptcg\.scene-mode\s*\{[^}]*\bwidth\s*:/.test(CSS), '场景卡不改 card 宽度（切换时整张卡不跳）');
  ok(!/\.ptcg\.scene-mode\s*\{[^}]*\bpadding\s*:/.test(CSS), '场景卡不改整体 padding（左右留白不变）');
  ok(!/\.ptcg\.scene-mode\s*\{[^}]*padding-(left|right)\s*:/.test(CSS), '场景卡不改左右 padding（图片宽度/比例不变）');
  ok(/\.ptcg\.scene-mode \.art-toggle\s*\{[^}]*top:\s*-/.test(CSS), '场景卡模式把造型按钮移到卡图上方');
  ok(/\.ptcg\.scene-mode \.ptcg-art img\s*\{[^}]*height:\s*auto/.test(CSS)
    && !/\.ptcg\.scene-mode \.ptcg-art img\s*\{[^}]*height:\s*100%/.test(CSS),
    '场景卡图片高度随宽度自适应（保持原比例，不拉伸）');
  section('重复任务从布置当天起生效（不能回溯，否则毁掉连击）');
  ok(/schedule === 'daily' \? S\.parentDate/.test(APP), '新增重复任务写 start_date');
  ok(/end_date: schedule === 'once' \? bindDate : null/.test(APP), '重复任务不写 end_date');
  ok(/t\.schedule === 'daily' && !t\.start_date && t\.created_at/.test(APP), '老数据（无 start_date）用 created_at 兜底');
  ok(/else if \(schedule === 'daily'\) \{ patch\.start_date = DB\.today\(\)/.test(APP), '改成重复任务时从今天起生效');

  ok(APP.includes("classList.toggle('scene-mode'"), '切换造型时同步切换 scene-mode');
  ok(/\.ptcg\.shiny-card/.test(CSS), '闪耀卡有整卡光晕');
  section('闪耀形态 + 场景卡：金框和特效都还在');
  ok(/\.ptcg\.shiny-card\.scene-mode \.ptcg-art\s*\{[^}]*border-color/.test(CSS), '闪耀场景卡仍有金色卡框');
  ok(/\.ptcg\.shiny-card\.scene-mode \.ptcg-art img\s*\{[^}]*filter:/.test(CSS), '闪耀场景卡有金光滤镜');
  ok(/\.ptcg\.shiny-card\.scene-mode \.ptcg-art img\s*\{[^}]*animation:\s*shiny-scene-glow/.test(CSS), '闪耀场景卡有呼吸光效');
  ok(/@keyframes shiny-scene-glow/.test(CSS), '闪耀场景卡光效关键帧存在');
  // 星光/扫光在场景卡里要保留（是闪耀形态的身份标识），只隐藏属性粒子和属性角标
  ok(/\$\{pm\.shiny \? cardGlitterHTML\(artMode === 'scene'\) : ''\}/.test(APP), '场景卡里仍渲染闪耀星光层');
  ok(!/ptcg-fx, \.ptcg-glitter, \.ptcg-type/.test(APP), '切换造型时不再把星光层一起隐藏');
  ok(/retuneGlitter\(artEl, mode === 'scene'\)/.test(APP), '切到场景卡时重算星星落点（卡面更高）');
  ok(/\.pm-card-mini\.shiny \.mini-frame::after/.test(CSS), '小卡有全息扫光层');
  ok(/\.pm-card-mini\.shiny \.mini-frame\s*\{/.test(CSS), '小卡有金色呼吸边框');

  section('成就图：点下去必须先有反馈，失败要有原因');
  // 坑：以前 shareCardHTML() 在 try 外面，老数据（出战宝可梦编号丢了/是脏值）一抛错就"点了没反应"
  ok(/ov\.innerHTML = `<div class="share-loading">/.test(APP), '点下去立刻显示「正在生成」');
  ok(/\.share-spin\s*\{[^}]*animation:/.test(CSS), '生成中有转圈动画');
  ok(/wrap\.innerHTML = shareCardHTML\(\);\s*\/\/[^\n]*try/.test(APP), '拼卡片 HTML 也在 try 里（出错能兜住）');
  ok(/const leadNo = \(lead && pkNoOf\(lead\)\) \|\| 25/.test(APP), '出战编号走 pkNoOf 兜底（老数据不会抛错）');
  ok(APP.includes("reportError('生成成就图失败'"), '失败原因写进错误日志，家长端能复制');
  ok(/Promise\.race\(\[done, timeout\]\)/.test(APP), 'html2canvas 卡住时有超时结论');
  ok(APP.includes('闪耀吧！✨'), '选卡态小卡的按钮文案');
};
