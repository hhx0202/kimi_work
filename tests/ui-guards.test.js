// 静态守护：几条容易在重构中丢掉的页面约束（读源码/样式断言）
const fs = require('fs');
const path = require('path');
const { ok, section, DB_SRC } = require('./harness');

const ROOT = path.join(__dirname, '..');
const CSS = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const { APP_SRC: APP } = require('./harness');

module.exports = async function run() {
  // app.js 有语法错的话整页白屏、所有测试却照样绿（都是静态断言）→ 这里直接试着解析一遍
  section('app.js 能解析（防重名变量这类致命错）');
  let parseErr = '';
  try { new Function(APP); } catch (e) { parseErr = e.message; }
  ok(!parseErr, 'app.js 没有语法错误' + (parseErr ? '：' + parseErr : ''));

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

  section('错误现场信息：只有 "Script error." 时也能定位');
  // 监听必须排在任何外部脚本之前，否则 CDN 脚本自己报错时没人接
  ok(HTML.indexOf('__earlyErrors') > 0 && HTML.indexOf('__earlyErrors') < HTML.indexOf('supabase-js'),
    '早期错误监听排在 CDN 脚本之前');
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
  ok(APP.includes('class="mini-no-badge"'), '小卡显示了图鉴编号（挪到图片左下角）');
  ok(APP.includes("'闪耀优先'"), '排序里有「闪耀优先」');
  ok(/mode === 'shiny'/.test(APP) && /\(b\.shiny \? 1 : 0\) - \(a\.shiny \? 1 : 0\)/.test(APP), '闪耀在前、同状态按编号');
  ok(/\.mini-no-badge\s*\{/.test(CSS), '编号有对应的角标样式');
  ok(/class="mini-exp/.test(APP), '小卡显示当前经验/总经验');
  ok(/\.mini-expbar\s*\{/.test(CSS), '小卡图片底部有经验进度条');

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
  ok(/const no = \(pm && pkNoOf\(pm\)\) \|\| 25/.test(APP), '上图的宝可梦编号走 pkNoOf 兜底（老数据不会抛错）');
  // 成就图的目的是"展示积累"：去掉今日任务/当前积分/近一周近一月，只留累计
  ok(APP.includes('累计完成任务') && !/今日任务<\/span>/.test(APP), '成就图展示累计完成任务，不再显示今日任务');
  ok(!/share-stats[\s\S]{0,600}?<\/div>\s*<div><b>\$\{S\.balance\}/.test(APP), '成就图不再显示当前积分框');
  ok(!/<span>近一周/.test(APP), '删掉了近一周/近一月那行小字');
  // 成就图右上角能换伙伴 / 换卡面，选完记在本机
  ok(/function openShare\(/.test(APP) && APP.includes('data-shtool="pick"'), '预览右上角能换伙伴');
  ok(APP.includes('data-shtool="art"') && APP.includes("art === 'scene'"), '能切换立绘 / 场景卡');
  ok(/lsSet\(LK\('share_pick'\)/.test(APP), '选择记在本机，下次打开还是这套');
  ok(/scenePath\(no, shiny\)/.test(APP), '场景卡按闪耀与否取对应一套素材');
  ok(APP.includes("reportError('生成成就图失败'"), '失败原因写进错误日志，家长端能复制');
  ok(/Promise\.race\(\[done, timeout\]\)/.test(APP), 'html2canvas 卡住时有超时结论');
  ok(APP.includes('闪耀吧！✨'), '选卡态小卡的按钮文案');

  ok(APP.includes('class="sc-head"') && APP.includes('每日打卡'), '顶部有「每日打卡」标题（打卡记录，不是炫卡）');
  ok(/第 \$\{Math\.max\(1, checkinDays\(\)\)\} 天/.test(APP), '副标带累计打卡天数');
  ok(/function checkinDays\(/.test(APP), '有累计打卡天数函数');
  ok(/\.share-card\s*\{[^}]*width:\s*560px/.test(CSS), '卡片改窄到 560（原 640，太扁）');
  ok(/\.sc-art\s*\{[^}]*height:\s*412px/.test(CSS), '立绘放大到 412，宝可梦当主角');
  ok(/\.share-scaler\s*\{[^}]*width:\s*560px/.test(CSS), '预览缩放框与卡片同宽（否则会盖住底部按钮）');

  section('成就图：去标题、去连击框、底部换宝可梦台词');
  // 只看 shareCardHTML 内部：页面标题 / 任务页的连击统计里本来就有这些字，不能全文件否定
  const SHARE = (APP.match(/function shareCardHTML\(\)[\s\S]*?\n}/) || [''])[0];
  ok(SHARE.length > 200, '取到成就卡模板');
  ok(!SHARE.includes('佑佑的任务岛'), '顶部标题已删（不再压着宝可梦）');
  ok(!SHARE.includes('必做全清连击'), '连击框已删（只剩累计完成 + 图鉴两个框，宽度跟卡片对得上）');
  ok(/const SHARE_TYPE_LINES\s*=/.test(APP) && /function shareQuote\(/.test(APP), '底部那句按属性挑，有台词池');
  ok(/class="sc-foot"><i><\/i>\$\{escHTML\(quote\)\}/.test(SHARE), '底部换成一句宝可梦台词');
  ok(!/sc-foot[\s\S]{0,40}DB\.today\(\)/.test(SHARE), '底部不再打印日期');
  // 预览里的卡片是 scale 缩过的，但 .share-scaler 的布局盒仍是 640×900，
  // 不挡住按钮的话手机上「关闭 / 生成图片」点了没反应（实测 elementFromPoint 命中的是 scaler）
  ok(/\.share-scaler\s*\{[^}]*pointer-events:\s*none/.test(CSS), '缩放后的卡面不吃点击');
  ok(/\.share-acts\s*\{[^}]*z-index:\s*6/.test(CSS), '底部按钮浮在缩略卡之上');

  section('小卡日期带年、详情省高度、介绍与招式等宽');
  ok(APP.includes('class="mini-date"') && APP.includes('class="mini-hm"'), '小卡日期带年，时分单独一段');
  ok(/function caughtTime\(/.test(APP), '有取时分的函数');
  ok(/@container \(min-width: 112px\)/.test(CSS), '卡片够宽才显示时分（窄卡只留年月日）');
  ok(APP.includes('class="ptcg-meta"'), '详情把捕获时间和经验并成一行');
  // 卡面底色随属性变（草绿 / 深紫），灰字直接压在上面看不清 → 时间必须自带浅色底
  ok(/\.ptcg-caught\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255/.test(CSS), '捕获时间有浅色胶囊底，任何属性底色上都看得清');
  ok(!APP.includes('点上面的名字'), '删掉了「点上面的名字…」提示');
  ok(/\.ptcg-flavor\s*\{[^}]*margin:\s*10px 0 0/.test(CSS), '图鉴介绍块和招式块等宽');

  section('进化链：跳转保持普通/闪耀，满级文案不重复');
  // 坑：链上只认编号不认形态，从 ✨ 二阶点一阶会掉到普通一阶上
  ok(/function evoChainLine\(no, cur\)/.test(APP), '链渲染知道当前是哪张卡（普通还是闪耀）');
  ok(/data-shiny="\$\{pv\}"/.test(APP), '每个阶段带上该跳哪种形态');
  ok(/showDexDetail\(Number\(el\.dataset\.evo\), sh === '1'/.test(APP), '按形态挑个体，不会掉回普通卡');
  ok(/class="ptcg-shiny\$\{altPm \? ' swap'/.test(APP) && APP.includes('🖼 普通形态'), '右上角徽章就是普通/闪耀切换按钮');
  ok(/swapBtn\.onclick = \(\) => showCardDetail\(altPm\)/.test(APP), '点徽章切到另一版那张卡');
  ok(!APP.includes('chain-alt') && !APP.includes('tap variant'), '链尾不再另放切换按钮（已并入徽章）');
  ok(APP.includes("'✅ 已满级（封顶）'"), '普通卡满级只讲满级');
  ok(!APP.includes("'✅ 已成为闪耀形态'"), '不再和经验行下面的「已拥有闪耀形态」重复提闪耀');
};
