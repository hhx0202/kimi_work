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
  // 「异色」小朋友不认识 → 按钮上统一写「动画」
  ok(APP.includes("art: '🖼 立绘'") && APP.includes("sprite: '✨ 动画'") && APP.includes("scene: '🎴 场景卡'"), '三档造型文案齐全');
  ok(!APP.includes("'✨ 异色'"), '不再对小朋友用「异色」这个词');
  ok(APP.includes('function cardArtSrc('), '造型选择有独立函数');
  ok(APP.includes('spritePath(pm.pokedex_no, true)'), '异色动图用 shiny 精灵');
  ok(APP.includes('assets/scenes/'), '场景卡用 assets/scenes/');
  ok(/\.ptcg-art\.sprite-art/.test(CSS), '异色动图有像素图展示样式');
  ok(/\.ptcg-art\.scene-art/.test(CSS), '场景卡有整卡展示样式');
  ok(/\.ptcg\.scene-mode \.ptcg-moves/.test(CSS) && /\.ptcg\.scene-mode \.ptcg-flavor/.test(CSS),
    '场景卡模式隐藏 App 自己的招式/图鉴介绍（卡面已印）');
  ok(!/\.ptcg\.scene-mode \.ptcg-top[\s\S]{0,40}display:\s*none/.test(CSS), '场景卡模式仍保留名字行');
  ok(/\.ptcg\.scene-mode \.ptcg-top\s*\{[^}]*margin-bottom:\s*8px/.test(CSS), '场景卡不再为造型按钮留 40px 空带');
  ok(/\.ptcg\.scene-mode \.ptcg-art\s*\{[^}]*aspect-ratio:\s*auto/.test(CSS), '场景卡按图片自身比例撑高（不裁切）');
  ok(/@supports not \(aspect-ratio: 1 \/ 1\)[\s\S]*\.ptcg\.scene-mode \.ptcg-art\s*\{[^}]*padding-bottom:\s*0/.test(CSS),
    'iOS 14 兜底里场景卡不套正方形 padding（否则底下多一大块空白）');
  // 场景卡不许单独设宽度/左右内边距：切换造型时整张卡宽度不变、图片不会被撑胖，比例保持素材原样
  ok(!/\.ptcg\.scene-mode\s*\{[^}]*\bwidth\s*:/.test(CSS), '场景卡不改 card 宽度（切换时整张卡不跳）');
  ok(!/\.ptcg\.scene-mode\s*\{[^}]*\bpadding\s*:/.test(CSS), '场景卡不改整体 padding（左右留白不变）');
  ok(!/\.ptcg\.scene-mode\s*\{[^}]*padding-(left|right)\s*:/.test(CSS), '场景卡不改左右 padding（图片宽度/比例不变）');
  // 造型按钮以前 absolute 挂在画面右上角、场景卡时又要靠 .scene-mode 挪出去，
  // 两种模式位置不同 → 切换时按钮跳、整页像闪一下。现在固定放在名字行里
  ok(/\.art-toggle\s*\{[^}]*flex:\s*0 0 auto/.test(CSS) && !/\.art-toggle\s*\{[^}]*position:\s*absolute/.test(CSS),
    '造型按钮是名字行里的普通 flex 件（不再 absolute 挂在画面上）');
  ok(!/\.ptcg\.scene-mode \.art-toggle\s*\{/.test(CSS), '场景卡不再给按钮加位移覆盖（位置恒定）');
  ok(/<div class="ptcg-top">[\s\S]{0,700}?class="art-toggle"/.test(APP), '按钮渲染在 .ptcg-top 名字行里');
  // 名字行右边那两枚胶囊必须同一个体系：同字号、同高、同一套内边距（以前 12px/1.5 对 10px/1.45）
  ok(/\.ptcg-shiny,\s*[\r\n\s]*\.art-toggle\s*\{[^}]*font-size:\s*11px/.test(CSS)
    && /\.ptcg-shiny,\s*[\r\n\s]*\.art-toggle\s*\{[^}]*height:\s*22px/.test(CSS),
    '形态徽章和卡面切换键共用同一套盒子（同字号 11px / 同高 22px）');
  // 阶段胶囊：以前靠 line-height + 上下不对称 padding，字在框里会偏；现在 flex 竖居中
  ok(/\.ptcg-lv\s*\{[^}]*display:\s*inline-flex[^}]*align-items:\s*center[^}]*justify-content:\s*center/.test(CSS),
    '阶段标签用 flex 居中（文字在胶囊正中间）');
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
  ok(APP.includes('sc-kicker') && APP.includes('每日打卡'), '小字定性「每日打卡」');
  ok(/每日打卡 <span class="sc-kicker-date">\$\{DB\.today\(\)\}<\/span>/.test(APP), '打卡后面带年月日');
  // 结果页曾用 .overlay 的 justify-content:center，内容一超高就上下同时溢出、还滑不动，
  // 底部按钮被浏览器工具栏挡住（用户报「页面撑满了，不能上下滑动」）
  ok(/\.overlay\.share-view\s*\{[^}]*overflow-y:\s*auto/.test(CSS), '预览/结果层自己能上下滚动');
  ok(/\.share-img\s*\{[^}]*max-height:\s*(66|72)(d)?vh/.test(CSS), '结果图限高（不把整页顶出去）');
  // 用户报：X 浏览器长按结果图「正在准备图片」然后静默消失（点保存按钮能下载）。
  // 原因是图片外面套了 <a download>，长按先命中外层链接 → 走「下载链接文件」→
  // 它的下载器解析不了 blob: → 失败。现在让长按直接命中 <img>
  ok(!APP.includes('share-img-link'), '结果图不包 <a>（长按直接命中图片本身）');
  ok(/<img class="share-img" src="\$\{imgSrc\}"/.test(APP), '结果图是裸 <img>，交给浏览器「保存图片」');
  ok(/\.share-img\s*\{[^}]*-webkit-touch-callout:\s*default/.test(CSS), '结果图显式允许长按菜单');
  // 用户实测：X 浏览器长按 blob / data / 链接包 blob 三种都存不了（浏览器自身的保存通道不支持）
  // → 提示文案主推「保存图片」按钮（这个已验证可用），别再教人长按
  ok(/class="share-tip">[^<]*「保存图片」/.test(APP), '结果页提示主推保存按钮，不教长按');
  // 长按彻底不行时的另一条路：支持文件分享的浏览器给「📤 分享存相册」（能进相册/发微信），
  // 不支持就完全不出现，别塞一个点了没反应的按钮
  ok(/navigator\.canShare\(\{ files: \[shareFile\] \}\)/.test(APP) && /data-share/.test(APP), '支持文件分享时才出「分享存相册」');
  ok(/navigator\.share\(\{ files: \[shareFile\]/.test(APP), '分享按钮走系统分享面板');
  ok(/\.share-acts > \*\s*\{[^}]*line-height:\s*20px/.test(CSS), '结果页按钮等高（a 与 button 的行高基线不同）');
  // 跨域脚本抛的 "Script error." 没有文件名/堆栈，弹横幅只会吓人 → 只进日志
  ok(/crossNoDetail/.test(APP) && /if \(!crossNoDetail\) showErrBanner/.test(APP), '跨域无详情错误不弹横幅');
  // 用户明确要求标题里别出现具体天数（"第 N 天"会随时间变得奇怪）
  // 用户 2026-10-24 改稿：小字改成「佑佑的每日打卡」、后半句改成随机尾巴、图鉴收集→宝可梦收集
  // 用户改「小训练家」时只改了一处、页面上没生效：中间那句以前在「算字号」和「渲染」里各写了一遍。
  // 现在只有 SHARE_TITLE_MID 一个来源，两处都引用它
  ok(/const SHARE_TITLE_MID = '的小训练家，'/.test(APP), '主标中间的「的小训练家，」只有一个定义');
  ok(/\$\{escHTML\(name\)\}\$\{escHTML\(SHARE_TITLE_MID\)\}\$\{escHTML\(tail\)\}/.test(APP), '渲染用的是 SHARE_TITLE_MID（不是写死的一份）');
  ok(/const titleText = `\$\{name\}\$\{SHARE_TITLE_MID\}\$\{tail\}`/.test(APP), '量宽度也用同一份，两处不会再走散');
  ok(/class="sc-kicker">\$\{escHTML\(CONFIG\.KID_NAME/.test(APP), '小字用 KID_NAME 的「XX的每日打卡」');
  ok(/<span>宝可梦收集<\/span>/.test(APP) && !APP.includes('图鉴收集'), '统计标签改成「宝可梦收集」');
  // 标题必须一行放下：字号按字符宽度算，超长自动缩（换行会把标题区顶高、整卡变长）
  ok(/style="font-size:\$\{shareTitleSize\(titleText\)\}px"/.test(APP), '标题字号按长度自适应');
  ok(/function shareTitleSize\(text\)/.test(APP) && /SHARE_TITLE_MIN/.test(APP), '字号有上下限钳制');
  ok(/SHARE_TITLE_AVAIL\s*=\s*490/.test(APP), '可用宽度按卡片实际内宽算');
  {
    const tails = (APP.match(/const SHARE_TAILS = \[([\s\S]*?)\];/) || [])[1] || '';
    const n = (tails.match(/'/g) || []).length / 2;
    ok(n >= 8 && tails.includes('今天的任务也完成啦'), `标题尾巴够随机（${n} 句，含用户原话）`);
    const lines = (APP.match(/const SHARE_LINES = \[([\s\S]*?)\];/) || [])[1] || '';
    const m = (lines.match(/'/g) || []).length / 2;
    ok(m >= 10, `通用台词池 ${m} 句`);
    const typeBlock = (APP.match(/const SHARE_TYPE_LINES = \{([\s\S]*?)\n\};/) || [])[1] || '';
    const t = (typeBlock.match(/'/g) || []).length / 2;
    ok(t >= 34 && /fire:\s*\['[^']+',\s*'[^']+'\]/.test(APP), `属性专属台词 ${t} 句（每属性 2 句）`);
    // 预览和截图是两次独立渲染：随机必须由 seed 派生，不能 Math.random
    ok(!/SHARE_TAILS[^;]*Math\.random/.test(APP) && /shareHeadTail\(seed\)/.test(APP), '尾巴按 seed 挑，不用 Math.random');
  }
  ok(!APP.includes('checkinDays'), '标题不再带天数（checkinDays 已删）');
  // 场景图是 height:auto，没写 aspect-ratio 的话：图未加载时高 0 → 缩放比按矮卡片算，
  // 图加载完卡片变 1039 高、缩放比不重算，卡片直接盖住底部的关闭/生成按钮
  ok(/\.sc-art\.scene\s*\{[^}]*aspect-ratio:\s*400 \/ 559/.test(CSS), '场景图固定宽高比（图片未加载也有高度）');
  ok(/function watchShareCard\(/.test(APP) && /new ResizeObserver/.test(APP), '卡片变高后自动重算缩放');
  ok(!APP.includes('的训练家，') || APP.includes("SHARE_TITLE_MID"), '旧主标（训练家）已换掉');
  ok(/\.share-card\s*\{[^}]*width:\s*560px/.test(CSS), '卡片改窄到 560（原 640，太扁）');
  ok(/\.sc-art\s*\{[^}]*height:\s*412px/.test(CSS), '立绘放大到 412，宝可梦当主角');
  ok(/\.share-scaler\s*\{[^}]*width:\s*560px/.test(CSS), '预览缩放框与卡片同宽（否则会盖住底部按钮）');

  section('成就卡：按属性换底色、场景卡出更高的图');
  ok(/const SHARE_PALETTES = \{/.test(APP) && /function sharePalette\(no\)/.test(APP), '按属性给了多套深色底');
  // 底色必须内联成解析好的颜色：html2canvas 不认 CSS 变量，写成 var(--x) 会变透明/黑
  ok(/background:linear-gradient\(168deg, \$\{pal\[0\]\}/.test(APP), '配色内联到卡面背景');
  ok(/backgroundColor: sharePalette\(sharePmNo\(\)\)\[3\]/.test(APP), '截图底色跟着配色走（圆角外不露色差）');
  ok(/share-card\$\{scene \? ' scene-mode' : ''\}/.test(APP), '场景卡给卡面加 scene-mode');
  ok(/\.share-card\.scene-mode \.sc-art\.scene\s*\{[^}]*width:\s*100%[^}]*height:\s*auto/.test(CSS), '场景卡按内容宽撑满（出更高的图）');
  ok(/\.share-card\.scene-mode \.sc-stage::before\s*\{[^}]*display:\s*none/.test(CSS), '场景卡不再画站台光（卡面自己有底）');

  section('分值步进器：−5 / +5');
  ok(/function stepInputHTML\(/.test(APP), '有步进器组件');
  ok(/closest\('\.step-btn'\)/.test(APP), '加减按钮走一次点击委托（弹窗里不用逐个绑定）');
  ok(/stepInputHTML\('pt-pts'/.test(APP) && /stepInputHTML\('pt-bonus'/.test(APP), '新建任务分值 / 多日完成奖励用步进器');
  ok(/stepInputHTML\('pt-givepts'/.test(APP) && /stepInputHTML\('pt-minuspts'/.test(APP), '奖励 / 扣分也用步进器');
  ok(/\.step-btn\s*\{[^}]*border-radius/.test(CSS), '加减按钮有单独样式');
  ok(/\.input-row \.req-toggle\s*\{[^}]*flex:\s*0 0 56px/.test(CSS), '必做/选做胶囊收窄，把宽度让给分值');
  // 等高：下拉 48 / 数字框 53 / 胶囊 53 原来各算各的，一行看着高低不齐
  ok(/\.input-row \.req-toggle \{ height: 50px/.test(CSS), '一行里的控件统一 50px 高');
  ok(/\.input-row \.stepper \{[^}]*flex:\s*0 1 120px/.test(CSS), '分值给固定宽度，不再按 number 输入框内容撑开（否则类别被挤没）');
  // 编辑弹窗：`.modal input` 写在文件后面，同权重会盖掉 .te-fld 的 margin-bottom → 数字框整体差 6px
  ok(/\.modal \.te-fld input\s*\{[^}]*margin-bottom:\s*0/.test(CSS), '编辑弹窗数字框与下拉/胶囊top 对齐（.modal 前缀不能省）');

  section('成就图：去标题、去连击框、底部换宝可梦台词');
  // 只看 shareCardHTML 内部：页面标题 / 任务页的连击统计里本来就有这些字，不能全文件否定
  const SHARE = (APP.match(/function shareCardHTML\(\)[\s\S]*?\n}/) || [''])[0];
  ok(SHARE.length > 200, '取到成就卡模板');
  ok(!SHARE.includes('佑佑的任务岛'), '顶部标题已删（不再压着宝可梦）');
  ok(!SHARE.includes('必做全清连击'), '连击框已删（只剩累计完成 + 图鉴两个框，宽度跟卡片对得上）');
  ok(/const SHARE_TYPE_LINES\s*=/.test(APP) && /function shareQuote\(/.test(APP), '底部那句按属性挑，有台词池');
  ok(/class="sc-foot"><i><\/i>\$\{escHTML\(quote\)\}/.test(SHARE), '底部换成一句宝可梦台词');
  ok(!/sc-foot[\s\S]{0,40}DB\.today\(\)/.test(SHARE), '底部不再打印日期');
  // data: URL 在手机上长按会提示「not download from this url」，存不进相册 → 必须走 Blob URL
  ok(/canvas\.toBlob\(/.test(APP) && /URL\.createObjectURL\(blob\)/.test(APP), '生成结果用 Blob URL（长按能存相册）');
  ok(/class="share-save"[^>]*download=/.test(APP), '结果页有 <a download> 保存按钮兜底');
  ok(/function releaseShareBlob\(/.test(APP) && /function closeShareResult\(/.test(APP), 'Blob URL 用完会释放');
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
  ok(/class="ptcg-shiny\$\{altPm \? ' swap'/.test(APP) && APP.includes('shiny-txt'), '右上角徽章就是普通/闪耀切换按钮（文字包在 .shiny-txt 里，窄屏可收）');
  ok(/swapBtn\.onclick = \(\) => showCardDetail\(altPm\)/.test(APP), '点徽章切到另一版那张卡');
  ok(!APP.includes('chain-alt') && !APP.includes('tap variant'), '链尾不再另放切换按钮（已并入徽章）');
  ok(APP.includes("'✅ 已满级（封顶）'"), '普通卡满级只讲满级');
  ok(!APP.includes("'✅ 已成为闪耀形态'"), '不再和经验行下面的「已拥有闪耀形态」重复提闪耀');
};

module.exports.walletChecks = () => {
  section('零花钱：入口、数据层、弹窗闭环');
  ok(APP.includes('data-action="wallet-kid"') && APP.includes('💰 我的零花钱'), '「我的」页有零花钱入口');
  ok(/function walletPendingPanel\(/.test(APP) && APP.includes('孩子记了一笔零花钱花销'), '待确认卡在最顶、直接 ✓/✕ 文案对');
  ok(/data-action="wallet-ok"/.test(APP) && /data-action="wallet-rej"/.test(APP), '确认 / 拒绝都有一键操作');
  ok(/function walletPanel\(/.test(APP) && APP.includes('wallet-range'), '家长中心有零花钱面板，余额口径可切近30天/累计');
  ok(/function openWalletKid\(/.test(APP) && APP.includes('我花了一笔'), '孩子端明细弹窗 + 右上角记花销按钮');
  ok(/function openWalletList\(/.test(APP) && /w-rowbtn del/.test(APP), '家长明细带删除按钮');
  ok(/function openWalletMgr\(/.test(APP) && /mode === 'parent' \? `<button class="btn-icon" data-wact="mgrdel"/.test(APP), '管理类别：删除入口只在家长端');
  ok(/<button class="btn-cancel" data-wact="wclose" style="width:100%">关闭<\/button>/.test(APP.split('function renderWalletKid')[1].split('function ')[0]), '孩子端明细底部有关闭按钮（不会手势返回也能退出）');
  ok(/uiSelectHTML\('w-k-cat'/.test(APP.split('function openWalletKidForm')[1].split('function openWalletList')[0]) && !/data-wact="kmgr"/.test(APP.split('function openWalletKidForm')[1].split('function openWalletList')[0]), '孩子表单类别是下拉（不跳管理）');
  ok(/function wKidCatPicked\(/.test(APP) && /'__new'/.test(APP), '下拉默认其他 + 最近使用排序 + 最下面「＋ 自定义…」');
  ok(/box\.outerHTML = uiSelectHTML\('w-k-cat', name, wKidCatOpts\(\)/.test(APP), '加完自定义类别重建下拉（选项列表是开表单时渲染的，不重建会显示空白且菜单里没有它）');
  ok(/\.w-amt-row \{[^}]*max-width:\s*190px/.test(CSS), '金额输入框收窄到 190px');
  ok(!APP.includes('w-addcat') && !APP.includes('w-cat editing'), '没有大输入框/胶囊编辑态残留');
  ok(/W\.formDir = 'out';/.test(APP), '家长记账默认记花销');
  // 数据层：demo / supabase 两个实现都要有，且必须导出
  ok(DB_SRC.includes('wallet_logs'), 'db.js 里有 wallet_logs 表');
  ['getWalletLogs', 'addWalletLog', 'confirmWalletLog', 'deleteWalletLog'].forEach(fn => {
    const n = (DB_SRC.match(new RegExp(`async ${fn}\\(`, 'g')) || []).length;
    ok(n === 2, `db.js 两个模式都实现了 ${fn}（现在是 ${n} 处）`);
  });
  ok((DB_SRC.match(/getWalletLogs: impl\.getWalletLogs\.bind/) || []).length === 1, '钱包方法已导出');
  ok(/wallet-range/.test(APP) && /W\.range\[who\]/.test(APP), '口径切换真的会改状态');
  ok(/readWalletCats\(settings/.test(APP), '自定义类别从 settings 读回');
};
