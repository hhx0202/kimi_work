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

## 工程约定
- 进度条配色在 `js/app.js` 的 `PROG_STOPS`（淡雾蓝 → 淡青绿 → 绿，RGB 插值）；**不要再用红/橙做低进度起始色**（用户觉得像报警），100% 仍走 `.progress-fill.full` 绿色 + 白光。
- 睡前/叮嘱这类「多行文本」，一律按行拆成 `<li>` 渲染，每行配一个道具图标（哈希稳定，不能用 `Math.random`），样式见 `.note-lines`。
- CSS 动画位移必须取 `background-size` 的整数倍，循环才无缝；`translateY` 用百分比会按伪元素自身高度算（踩过坑）。
- 卡片底部 4 列按钮文案控制在 5 字以内（`.ptcg-btns` 四等分，12px）。
- 发布：`git push origin master` 自动发 GitHub Pages；验证线上文件必须带 `?v=$(date +%s)` 破 CDN 缓存，再比对 md5。
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
- **闪耀卡是一件道具**（`item_logs.item='shiny'`，`S.shinyCards`＝库存）：连清领奖产出，宝可梦页 `.shiny-bar` 点「使用」→ `shinyPickOn` 选择态 → 点一只普通卡 `applyShinyCard()` 扣一张并多生成一张 ✨ 卡。任何阶段都能用，一张卡对应一只（不跨进化链继承）。
- 小卡列表按**获取先后**排序（`caught_at`，同时间按 id）；第一行「属性胶囊 + 名字」，第二行 `🕒 MM-DD HH:mm` 获取时间。改卡片信息时保持这两行结构，别把属性放回第二行。

## 手机手势约定（踩过的坑）
- 需要在手机上手势「自己接管」的元素（拖动排序、左滑、长按），`touchstart` 必须是 `{passive:false}` 才能 `preventDefault()` 掉系统长按选字（放大镜/选区手柄）；passive 监听里调 preventDefault 无效，表现为「长按出来个放大镜但拖不动」。CSS 再补 `touch-action:none` + `user-select:none` + `-webkit-touch-callout:none`。
- 测手势必须用 CDP `Input.dispatchTouchEvent` 的真实序列（touchStart → 停 300ms → touchMove → touchEnd），且坐标是**视口坐标**，目标在折叠线以下要先 `scrollIntoView`。

## 响应式 / 布局约定（用户对「窄屏堆叠」很敏感）
- **同一块区域在不同状态（普通 ↔ 排序/选择）布局必须完全一致**：不要用 `display:none` 隐藏标签内的 ✕/分数（宽度会变，每行个数就跳），用 `visibility:hidden` 保留占位。改完用量宽脚本对比两态的 `width + top` 是否逐一相同。
- 手机端常用任务固定两列：`#pt-quick-list` 在 ≤520 用 `grid-template-columns:repeat(2,minmax(0,1fr))`；`minmax(0,1fr)` 不能省，否则 grid item 的 `min-width:auto` 会顶出屏幕。名字 `flex:1 1 auto; min-width:0`。
- 日期条这种「左中右三件套 + 可有可无第四件」：日期给两套文本（完整 / MM-DD 短格式）按断点切换，多余的按钮（如「回到今天」）整行独占，别硬挤同一行。
- 320 / 375 / 390 三档都要截图看，375 档最容易出现「名字只剩 3 个字」。

