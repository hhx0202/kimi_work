# kimi_work 项目长期记忆

## 视觉/样式验证方式（重要）
- **用户明确要求：先本地测，不要等上线再测。** 本地链路：`python serve.py`（ThreadingHTTPServer，localhost 命中 `DB_MODE='demo'`，数据走 `km_` 本地 demo）+ chromium headless 带 `--remote-debugging-port=9333 --user-data-dir=<临时目录>`，再用 Node 22 自带的 WebSocket 跑 CDP：`Runtime.evaluate`（改 `localStorage` / 直接调 `S`、`DB`、`render()` 造状态）+ `Emulation.setDeviceMetricsOverride`（390/320 移动视口）+ `Page.captureScreenshot`（可带 clip 只截某个卡片）。上线后只做一次「md5 是否一致」的部署确认即可。
- Edge headless 在沙箱里渲染不出内容，但 **playwright 自带的 chromium 可以截图**：
  `%LOCALAPPDATA%/ms-playwright/chromium-1140/chrome-win/chrome.exe --headless=new --disable-gpu --hide-scrollbars --window-size=W,H --virtual-time-budget=3000 --screenshot=out.png file:///...`
- 长驻的 chromium 必须用后台任务方式启动（`run_in_background`），普通 `&` 启动的会在 shell 退出时被回收，CDP 端口随即 ECONNREFUSED。
- 改配色类改动：先做一个对比页（同一容器里并排渲染候选配色 + 各档百分比），截图挑完再改进正式代码，别直接改完上线看效果。
- 改卡面/动画类 CSS 时，先在系统临时目录做一个预览页（`file://` 引 `css/style.css` 与 `assets/artwork/<no>.png`），截图自检再提交，不要只靠推理。
- 卡面特效层 `.ptcg-fx` 是叠在立绘 `<img>` **之上**的，任何满屏元素都会遮住宝可梦；水/毒这类效果要么做成低透明度纹理/柔雾，要么只压局部。水系已改成「整卡浪花纹 + 水滴波纹 + 气泡」（波浪是低透明度线纹，可以铺满），改完必须 320px 卡 + 390px 移动视口各截一张确认立绘还清楚。
- 水系比别的属性多两个子元素（`.wv-ripple` / `.wv-bubble`），由 `cardFxHTML` 只对 `wave` 输出；伪元素只有两个，层数不够就加子元素，别硬塞背景层导致动画互相覆盖。

## 部署与访问（2026-10-22 定稿，重要）
- **线上地址：`https://kimi-work.pages.dev`（Cloudflare Pages）**。已验证：任务/宝可梦数据走同一个 Supabase 库，图片能正常加载。
- **两个域名并存，别写成"弃用 GitHub Pages"**（2026-10-23 用户纠正）：`https://kimi-work.pages.dev`（Cloudflare，国内主力）+ `https://hhx0202.github.io/kimi_work/`（GitHub Pages，海外/备用，push 时照样自动更新）。国内走 Cloudflare 的原因：github.io 实测只有 **2.7 KB/s**（118KB 立绘 30 秒都下不完 → "图片加载不出来"），Cloudflare 40 KB/s 以上。两个域名连同一个 Supabase 库，数据互通。
- **`*.workers.dev` 被 DNS 污染**（解析到 Facebook 的 `face:b00c` / `128.242.240.244`，国内直接打不开）；**`*.pages.dev` 正常**（解析到 Cloudflare `172.66.x.x` / `104.18.x.x`）。**只能用 Pages，不能用 Workers 的 workers.dev 域名。**
- **EdgeOne Pages 已弃用**：域名是随机子域名（记不住），且原项目后来直接返回 401 打不开。
- **项目是 Direct Upload 创建的，不能事后绑 Git**（Cloudflare 官方限制，官方原文：Direct Upload projects can't switch to Git integration later）。自动部署用 **GitHub Actions + wrangler**：`.github/workflows/deploy-pages.yml`，push master 触发（2026-10-23 已跑通）。
- **Cloudflare account id = `306aae3e2cbdaf6a127c4604cf7911c1`**（注意 `af6a`、`cf`，曾把它误读成 `fa6f`/`cd`，导致连续 5 次 `Authentication error 10000`）。
- **API Token 权限**：`Account → Cloudflare Pages → Edit` + `User → User Details → Read`，Account Resources 必须 Include 到具体账号。**该 token 没有"列账号"权限，`GET /accounts` 返回空数组 `result:[]` 是正常的**，别误判成权限不足；要验证权限得用 `GET /accounts/<id>/pages/projects`（返回里有 `"name":"kimi-work"` 就对了）。
- **workflow 里必须显式传 `CLOUDFLARE_ACCOUNT_ID`**：不传的话 wrangler 会去自动检索账号（调 `/accounts`），而该 token 无此权限 → 必然报 `Failed to automatically retrieve account IDs`。
- **发布目录必须是 `dist`**，只含 `index.html intro.html css js assets` 五项。直接发仓库根目录会被 `.git` 里 31.6MB 的 pack 顶掉（Cloudflare 单文件上限 25MiB），而且会把 `.git`/`sql`/`.workbuddy/memory` 全部公开。
- 手动部署：先 `cp -r index.html intro.html css js assets D:/AI/kimi_dist/`，再 `npx wrangler pages deploy D:/AI/kimi_dist --project-name kimi-work --branch master`（wrangler 已用 device flow 登录过，token 在本机）。
- **用户家的 DNS 坑**：路由器 `192.168.2.1`（小米）只返回 AAAA、不返回 A，导致 `kimi-work.pages.dev` 在本地解析成 Non-existent domain；阿里 `223.5.5.5` / 腾讯 `119.29.29.29` 正常。排查域名问题先用 `nslookup <域名> 223.5.5.5` 对比，别急着怀疑平台。
- **Steam++（Watt Toolkit）会改 hosts**：把 `github.com` / `github.io` / `api.github.com` 等 50+ 域名指到 `127.0.0.1`，由它本地 443 端口的代理转发——实测把 github.io 的下载速度从 39 KB/s 压到 2.7 KB/s。**这不是墙**：`nslookup`（不读 hosts）能解析到真实 IP，`ping`（读 hosts）却是 127.0.0.1。删了 hosts 它运行时会写回去。
- **git remote 已改为 `ssh://git@ssh.github.com:443/hhx0202/kimi_work.git`**：因为 hosts 劫持了 github.com，`git push` 连 22 端口会 `Connection refused`；GitHub 的 443 SSH 入口不在 hosts 里，实测可用。改完 `git push` 直接能推。
- **jsdelivr 在国内只有 5.9 KB/s**（三个库要半分钟才拉完）。第三方库走 CDN 是用户定的方向，但要知道这个代价；页面对此的缓冲是浏览器缓存。

## 工程约定
- **禁用原生 `prompt()/confirm()/alert()`**：预览面板（iframe/webview）没 `allow-modals` 会报 "prompt() is not supported"。统一用 `askConfirm()`（返回 Promise）和自绘弹窗（如 `openParentAuth()`）。
- 进度条配色在 `js/app.js` 的 `PROG_STOPS`（淡雾蓝 → 淡青绿 → 绿，RGB 插值）；**不要再用红/橙做低进度起始色**（用户觉得像报警），100% 仍走 `.progress-fill.full` 绿色 + 白光。
- 睡前/叮嘱这类「多行文本」，一律按行拆成 `<li>` 渲染，每行配一个道具图标（哈希稳定，不能用 `Math.random`），样式见 `.note-lines`。
- CSS 动画位移必须取 `background-size` 的整数倍，循环才无缝；`translateY` 用百分比会按伪元素自身高度算（踩过坑）。
- 卡片底部 4 列按钮文案控制在 5 字以内（`.ptcg-btns` 四等分，12px）。
- **发布铁律（2026-10-22 用户明确要求，优先级最高）：改完可以 `git commit` 留本地，但绝对不要自己 `git push`。必须先把改动交给用户检查、等他亲口说"没问题/可以推"才推。** 背景：EdgeOne 部署后白屏，用户是事后才知道线上变了；他要保留最终控制权。要验证时给他 `kimi-work.pages.dev` 或明确说"还没推"。
- **第三方库走 CDN，不要搬进仓库**（2026-10-22 用户明确否掉这个方向）：`index.html` 保持 `cdn.jsdelivr.net` 外链 + `crossorigin="anonymous"`。曾把三个库下载进 `js/vendor/`（e41853e），用户判断"完全没有意义、方向就是错的"，已 revert（638a8f4）。**别再自作主张做 vendor 化**；遇到组件加载失败先查网络/缓存/版本号，别动架构。
- 发布：经用户确认后 `git push origin master` → GitHub Actions 自动部署到 Cloudflare Pages（workflow 见部署一节）；验证线上文件必须带 `?v=$(date +%s)` 破 CDN 缓存，再比对 md5。
- 临时测试/预览文件用完即删。

## 数据字段约定（pokemon-data.js）
- `e`: 进化后是哪只（父 → 子，单线）；`ev: [..]`：分支进化（伊布 → 水/雷/火伊布）。
- 基础形态（可捕捉）判定 = `PK_EVOLVE_FROM[no] === undefined`；捕捉池与 `isBaseForm()` 都靠它，改数据务必保持 `e`/`ev` 登记完整。
- 判断"还能不能进化"一律用 `hasNextEvo(no)`，不要用 `!info.e`（伊布无 `e`，会被误判成无进化链）。
- 老数据可能丢 `pokedex_no` → 阶段角标误标「基础」。统一用 `pkNoOf(pm)`（按名字兜底），`refreshAll` 会自动回写修数据。

## 任务/进度约定
- 多日任务进度 = 子任务权重完成率：`childWeightMode` 依次尝试 points → percent → 条数均分（历史 0 分数据兜底）；不要再写死按 points 求和。
- 新建多日任务时子任务必须有分数（`parseSubtasks` 默认 10），父任务总分 = 子任务之和；演示种子也要按占比给分，否则进度永远 0。
- 判断子任务是否完成用 `isTaskDoneEver(id)`（跨天累计），不要用 `taskProgress` 比 percent。

## 连清（连续必做全清）约定
- 口径：**当天所有必做任务都完成 = 1 天**，分母必须和进度条一致（`dayTasksForProgress(date).filter(t => t.required !== false)`）；当天没有必做任务不算达标。
- 三个函数别混用：`reqDayDone(date)` 单天判定、`reqStreakDays()` 真实连击（零点不归零，今天没做完从昨天数）、`streakCycleDays()` **本轮**（上次领奖之后）连了几天——进度条和领奖门槛都用它。
- 领奖走「动画 → 用户自己点领取」两步：`checkin()` 达标时只 `showStreakReady()`（不 await），`claimStreak()` 才发奖；球用 `DB.hasItemReason('必做全清N天_'+today)` 去重，同一天不能刷。
- 文案不要用「全勤」（有歧义，用户会以为是「任意任务打卡」），统一写「必做全清」。

## 宝可梦卡面/卡片约定
- 闪耀形态一律「**普通卡保留 + 额外多一张 ✨ 卡**」，`addShinyCopy` 生成、`hasShinyCopy(no)` 防重复；非 shiny 的卡一旦有同编号闪耀卡，`isMaxed` 即为 true、`canEvolve` 返回「已拥有闪耀形态」，不能再点亮。
- **闪耀卡是一件道具**（`item_logs.item='shiny'`，`S.shinyCards`＝库存）：连清领奖产出，宝可梦页 `.shiny-bar` 点「使用」→ `shinyPickOn` 选择态 → 点一只普通卡 `applyShinyCard()` 扣一张并多生成一张 ✨ 卡。任何阶段都能用，一张卡对应一只。
- **闪耀沿进化链往后继承**（2026-10-22，`shinyLineageNo / willInheritShiny`）：闪耀卡用在基础形态上后，这条链的普通卡**进化出来的形态直接是 ✨**（`evolvePm` 连 `shiny` 一起写库，动画走异色图）。只向后继承（✨ 只在后面的形态时，前面的卡进化不做成闪）、目标编号已有 ✨ 就不再生成第二张。血统是从 `S.pokemons` 推导的，没加数据库字段。
- 进化阶段在 UI/排序里统一叫「**进化阶段**」（基础 / 一阶 / 二阶，卡牌术语「基础 / 1阶进化 / 2阶进化」）；`stageText(pm)` 只出阶段文字，`evoStageLabel(pm)` 给角标用、闪耀卡加 ✨ 前缀。
- **代价型按钮一律二次确认**：捕捉（扣球）、买球（扣积分）都先 `askConfirm`，文案里写清"花什么/还剩多少"，`danger:false` 用蓝色主按钮；确认后要再判一次状态（别的设备可能改了数据）。
- 小卡列表按**获取先后**排序（`caught_at`，同时间按 id）；第一行「属性胶囊 + 名字」，第二行 `🕒 MM-DD HH:mm` 获取时间。改卡片信息时保持这两行结构，别把属性放回第二行。
- **场景卡分两套**（2026-10-23）：`scenePath(no, shiny)` → 普通卡 `assets/scenes/{no}.jpg`（第一套，简体中文卡面）、闪耀卡 `assets/scenes-shiny/{no}.jpg`（第二套，跨系列精选的全图异画/现代卡）。第二套由 `tools/fetch_shiny_scenes.py` 抓取，规则与来源坑写在 HANDOFF「第二套场景卡素材来源」一节；**别把 `sv3pt5` 整段排除**——它的普卡与第一套同图要排除，但它的 Illustration Rare/SIR 是整幅异画、第一套没用过，必须允许。

## 手机手势约定（踩过的坑）
- 需要在手机上手势「自己接管」的元素（拖动排序、左滑、长按），`touchstart` 必须是 `{passive:false}` 才能 `preventDefault()` 掉系统长按选字（放大镜/选区手柄）；passive 监听里调 preventDefault 无效，表现为「长按出来个放大镜但拖不动」。CSS 再补 `touch-action:none` + `user-select:none` + `-webkit-touch-callout:none`。
- 测手势必须用 CDP `Input.dispatchTouchEvent` 的真实序列（touchStart → 停 300ms → touchMove → touchEnd），且坐标是**视口坐标**，目标在折叠线以下要先 `scrollIntoView`。

## 响应式 / 布局约定（用户对「窄屏堆叠」很敏感）
- **同一块区域在不同状态（普通 ↔ 排序/选择）布局必须完全一致**：不要用 `display:none` 隐藏标签内的 ✕/分数（宽度会变，每行个数就跳），用 `visibility:hidden` 保留占位。改完用量宽脚本对比两态的 `width + top` 是否逐一相同。
- 手机端常用任务固定两列：`#pt-quick-list` 在 ≤520 用 `grid-template-columns:repeat(2,minmax(0,1fr))`；`minmax(0,1fr)` 不能省，否则 grid item 的 `min-width:auto` 会顶出屏幕。名字 `flex:1 1 auto; min-width:0`。
- 日期条这种「左中右三件套 + 可有可无第四件」：日期给两套文本（完整 / MM-DD 短格式）按断点切换，多余的按钮（如「回到今天」）整行独占，别硬挤同一行。
- 320 / 375 / 390 三档都要截图看，375 档最容易出现「名字只剩 3 个字」。

