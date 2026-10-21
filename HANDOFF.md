# 🤝 佑佑的任务岛 · Agent 交接文档

> 给接手开发者的完整上下文。先读本文件 + README.md，再动手。
> **最后更新：2026-10-21**（数据库 `sql/upgrade_all.sql` 已由用户在 Supabase 执行完毕，线上可直接用真库）

## 一、产品全貌（用户要什么）

给孩子（4 年级）的作业 + 打卡激励工作台。家长布置任务，孩子打卡赚积分，用积分玩宝可梦。

**用户核心诉求（决策史）**：
- 双端：家长手机布置 / 孩子平板查看打卡
- 激励是核心：宝可梦收集、喂养、进化，**越炫越好**
- 免费、简单、纯前端优先
- 布置任务必须手机输入友好（逗号/分号/顿号/竖线/空格都当分隔符）
- 任务分三类 + 必做/选做（见 README）
- 长期任务用**子任务模式**：家长拆子任务配分数，孩子勾子任务累计进度
- 家长要能一键生成成就图发朋友圈（已做：html2canvas）

## 二、当前已完成

| 模块 | 功能 | 状态 |
|---|---|---|
| 任务 | daily/once/weekly(子任务)/必做可选/批量粘贴/日历 | ✅ |
| 奖励 | 任务积分、必做全清+5、选做全清+5、**连续 7 天必做全清**在最下方进度条点「领取」得 ✨ 闪耀卡（宝可梦页点「使用」自己挑一只）、多日完成奖 | ✅ |
| 提交/审批 | 孩子点「完成」→ **乐观更新立即变已提交**（不等数据库，DB 后台落库失败才提示）；再点可撤销；家长「待确认积分」审批后 → **已完成**；积分先进待发池；**任务完成后不再下架**，待审核/已完成都保留在孩子页与家长页列表展示，按钮按状态显示（完成/已提交/已完成） | ✅ |
| 详情 | 任务详情弹窗保持**一行紧凑信息**：分类 · 分数 · 类型 · 开始日期 · 截止日期（+剩 N 天），子任务跟随多日任务的截止日期并标注「随多日任务」，另起一行写所属多日任务；**多日任务**点进度条弹出的子任务清单头部带截止日期/剩余天数/进度/全清奖 | ✅ |
| 进度条 | 必做、选做两条进度条**都可点开该组清单**（完成 N/M + 全清奖 + 每行状态），再点某行 → 该任务详情；分母 = `dayTasksForProgress()`，与条上数字严格一致。**颜色随百分比走**：0% 淡雾蓝 → 半程淡青绿 → 100% 绿（不再从红色起，刚布置不该像报警），完成态是绿色 + 白光扫过 | ✅ |
| 家长消息 | 任务页顶端消息卡（送球/扣分/审批通过/额外奖励），孩子点「知道啦」才消失，多条可一键全确认；Tab 有未读角标；存本机，刷新不丢 | ✅ |
| 出错提示 | 全局 `error`/`unhandledrejection`/DB 报错 → 顶部红条（可展开堆栈、一键复制），同类 5 秒合并，最多 30 条；家长中心「🐞 错误日志」可查 | ✅ |
| 常用任务 | 家长自维护标签（图标+名称+分数+✕）：单击开「添加任务」表单（名称/类别/分数/必做/布置到 + **小提示**都可改）确认、长按改名称/分数、＋ 新增（图标随机分配）；**「排序」按钮**进入排序模式（长按拖动换位、松手写回 `km_quick_tasks`，点「确认」或点别处退出）。排序拖动有 `.dragging` 视觉反馈（放大+蓝边上浮），iOS 不支持 `navigator.vibrate` 靠视觉提示 | ✅ |
| 任务行操作 | 家长端任务行可长按拖动排序、**左滑露出「删除」**（滑 ≥40px 松手，点行或点别处收起，同一时间只开一行）；任务行已禁选字/弹复制菜单（`enableDragSort` 拦截 `selectstart`/`contextmenu` + `.prow` CSS `user-select:none`），手机长按不会抢成选字 | ✅ |
| 家长端其它 | 「📅 批量布置多天任务」只留按钮（说明都在弹窗里）；「🆕 新建任务」「🎁 奖励 / 扣分」标题带图标；原「本周完成率」面板已删除 | ✅ |
| 演示 | intro.html 介绍页 + **演示模式**（独立 `kmd_` 数据，家长端进入/退出/重置） | ✅ |
| 捕捉 | 必出新且**只出基础形态**（`CATCH_POOL` = 没有进化前体的编号）；进化形态只能靠喂养进化获得，伊布分支进化会弹选择框；基础形态抓齐后不扣球；**闪耀形态不由捕捉产出** | ✅ |
| 喂养 | 1 分 = 1 exp，可自定义积分数、「🚀 刚好进化」一键补齐；喂完**停在详情页** | ✅ |
| 进化 | **无等级**，经验满一管即进化（基础 300 → 一阶，再 500 → 二阶，再满 100 → ✨闪耀形态），不花积分；闪耀形态经验封顶 | ✅ |
| 图鉴 | 151 只官方中文介绍 + 每只 4 个官方招式；未收集 = 剪影卡（不剧透），**151 格全部可点**；闪耀按整条进化链点亮 | ✅ |
| 卡牌 | 小卡网格 + 翻牌 PTCG 大卡：属性边框/场景背景/**4 招式（点行展开官方说明）**/进化链/图鉴介绍 | ✅ |
| 卡面特效 | 9 组属性氛围（火/水/电/草虫/冰/毒/超能幽灵龙妖精/岩地钢格斗/飞行一般）+ 闪耀金色星雨 + 全息光带；列表小卡也有同款粒子。**水系是整卡水波**：浪花纹底（无缝平铺）+ 水下蓝调 + 底部水滴波纹扩散 + 上升气泡 + 水光扫过 | ✅ |
| 家长端 | 奖励积分/扣分/送球/待确认审批/积分流水（带时间，可撤销）/统计/错误日志/规则设置 | ✅ |
| 孩子端 | 双进度条、按类别分区（校内在前）、历史日期切换（只读）、打卡日历、提交流程 | ✅ |
| 类别 | 类别自动记忆（下拉可选历史类别）+ 家长端管理 + 孩子端分区 + 规则小抄 | ✅ |
| 子任务 | 每个子任务都带分数（父任务总分 = 子任务之和），进度按子任务权重算；历史 0 分子任务自动按 percent / 条数均分兜底，不会卡在 0%；百分比自动归一化 + 多日任务 ✏️ 编辑 | ✅ |
| 排序 | 必做/选做两区平铺、↑↓ + 长按拖动（650ms）；家长调完孩子端同步（共用 `taskSort`：sort → 类别 → 名称）；家长端任务行小字已去掉日期图标（`prowRowHTML` 不再显示 📅） | ✅ |
| 分享 | 成就图生成，长按保存发朋友圈 | ✅ |
| 素材 | 302 动图 + 151 高清插画 + 151 属性 + 151 招式表 | ✅ |
| 数据 | 双模式（demo localStorage / supabase 真库）；localhost 自动 demo、线上自动真库 | ✅ |
| 视觉 | 标题统一「佑佑的任务岛」（无空格）；宝可梦风 SVG 图标；123 条顶部短句按小时换 | ✅ |

## 三、技术架构速览

- **纯静态前端**：无构建、无 node_modules，双击 `start.bat`（或 `python serve.py`）起服务器即可跑
- **免后端**：前端直连 Supabase（publishable key），所有逻辑在浏览器
- **关键文件**：
  - `js/config.js` — 全部游戏规则数值（改规则只动这里）
  - `js/pokemon-data.js` — 151 只中文名/进化链/稀有度
  - `js/pokemon-types.js` — 151 只属性（卡牌配色 + 特效分组用）
  - `js/pokemon-flavor.js` — 151 只官方中文图鉴介绍（PokeAPI 抓取）
  - `js/pokemon-moves.js` — 151 只各最多 4 个官方招式 `[[名,属性,威力,分类,说明]]`；由 `tools/fetch_moves.js` 生成（缓存可重跑）
  - `js/poke-icons.js` — 手绘宝可梦风 SVG 图标库 + 类别图标规则（`CAT_ICON_RULES`）
  - `js/db.js` — 数据层，demo/supabase 双实现，接口一致（含 notes/settings）
  - `js/app.js` — 主程序（渲染 + 游戏逻辑 + 动画），约 3500 行
  - `css/style.css` — 全部样式与动画
  - `sql/upgrade_all.sql` — 唯一建库脚本（幂等，Supabase 只跑它；**已执行**）
- **数据模型**（Supabase，建表/升级全部合并在 `sql/upgrade_all.sql`，幂等可重复执行）：
  - `tasks`：title/category/points/schedule(daily=重复/once=单次/weekly=多日/child=子任务)/deadline/parent_id/percent/required/active/**start_date/end_date/hint/sort/bonus**/note(兼容占位)
  - `task_logs`：task_id/log_date/completed/progress/**approved**（`approved=false`=已提交待审批，默认 true 兼容旧数据；task_id+log_date 唯一，删任务保留历史）
  - `pokemon`：name/pokedex_no/level(遗留不用)/exp/shiny
  - `point_logs`：log_date/amount/reason/confirmed(是否已发放)/task_id(撤销回退)/created_at(发生时间)（余额=SUM(confirmed)）
  - `item_logs`：item('ball')/amount/reason（球数=SUM）
  - `notes`：log_date(唯一)/note（家长每日叮嘱，随日期切换展示；当天没记录时读最近的更早一条=自动沿用，存空串=从这天起清除）
  - `settings`：key/value（「⚙️ 规则设置」覆盖 config，全家同步）

## 四、规则数值（`js/config.js`；家长端「⚙️ 规则设置」可动态改其中 13 项，存 settings 表）

| 项 | 值 | 可动态改 |
|---|---|---|
| 家长密码 `PARENT_PASSWORD` | 2048 | — |
| 必做全清 `REQUIRED_DONE_BONUS` | 5 | ✅ |
| 选做全清 `OPTIONAL_DONE_BONUS` | 5 | ✅ |
| 多日完成 `WEEKLY_DONE_BONUS` | 10 | ✅ |
| 多日超期每日扣 `OVERDUE_DAILY_PENALTY` | 5 | ✅ |
| 单任务积分上限 `MAX_POINTS_PER_TASK` | 100 | ✅ |
| 出战每任务经验 `LEAD_EXP_PER_TASK` | 1 | ✅ |
| 1 积分换经验 `POINTS_TO_EXP` | 1 | ✅ |
| 进化第 1 段 `EVO_EXP_1` | 300 | ✅ |
| 进化第 2 段 `EVO_EXP_2` | 500 | ✅ |
| 闪耀形态 `SHINY_EXP` | 100 | ✅ |
| 连清天数 `STREAK_DAYS_FOR_BALL` | 7（必做全清，断一天重数） | ✅ |
| 达标送卡 `STREAK_REWARD_SHINY` | 1（张闪耀卡） | ✅ |
| 单次补卡天数 `MAKEUP_DAYS` | 1（只补单次任务；补卡不发当天全清奖） | ✅（已在 SETTING_FIELDS） |
| 买球价 `BALL_PRICE` | 100 | ✅（已在 SETTING_FIELDS） |
| 稀有概率 `RARE_PROBABILITY` | 0.15 | — |
| 默认类别 `DEFAULT_CATEGORIES` | 校内/校外/作业/打卡/阅读/运动/家务/英语/数学/音乐/练字/编程 | — |

> **注意**：`EVO_EXP_1/2`、`SHINY_EXP` 已进 `SETTING_FIELDS`（见 app.js 顶部），改规则优先教家长用「⚙️ 规则设置」，别直接改代码；代码里的值只是默认值。

## 五、关键实现位置（改哪儿找哪儿）

- **任务渲染/排序**：`renderTasks / catSectionHTML / taskCardHTML / taskSort`；列表按查看日期渲染（`tasksOnDate(S.viewDate)`，翻历史显示那天的任务，别改回 `todayTasks()`）；属性按日期取版本（`taskAttrFor`）；进度用 `dayTasksForProgress(date)`（任务不再因完成而下架，列表不过滤 active，已完成/待审核都保留；该函数仍保留打卡记录兜底兼容历史下架数据）。历史日期只读：未完成显示禁用按钮「未完成」（不是可点的「查看历史」）
- **打卡链路**：`checkin`（**乐观更新**：先改本地 `S.logs` 立即渲染按钮变「已提交」，DB 写入放 `bgWrite` 后台落库，失败才提示错误；打卡记账日期用 `day = S.viewDate`（补卡）或今天）→ `cancelSubmission`（撤销）→ `confirmPending`（审批发分）→ `undoPoint`（撤销已发分）
- **补卡**：`isMakeupDate / makeupDays`（config `MAKEUP_DAYS`，默认 1）。孩子端翻到补卡窗口内的历史日期时，漏掉的**单次任务**显示「⏪ 补完成」（重复/子任务不可补；单次任务已完成过任何一天也不能再补，`isTaskDoneEver` 防重复领分）。补交记录写到那天（积分流水 `log_date` 也是那天，家长端待确认面板按日期分组照常审批），**不发当天的必选/可选全清奖**（`awardReq/awardOpt` 在补卡分支被跳过）；补卡期内单次任务的待审批提交可撤销（撤了可再补），重复任务的历史提交不可撤销（撤了没法重新提交）。连续全清（streak）按打卡记录自然计算，补卡补齐的那天会计入连击但无全清奖分
- **删除重复任务 = 软停用**（`delTask`）：daily 任务删除改为 `updateTask(id, { end_date: 昨天 })`，不硬删。之前日期照常显示任务卡/打卡状态/全清判定（`inEffect` 按日期过滤，家长端清单本来就按 `S.parentDate` 渲染，无需额外处理）；今天起不再出现；历史统计（`doneStats`）和打卡记录面板照常（任务仍在表里）。`sameTitleTask` 会跳过已结束（`end_date < 今天`）的任务，停用后可再建同名任务。单次/子任务/多日删除仍是硬删（行为未变）。无需改 db.js/SQL（end_date 列早已存在）
- **编辑只对「今天及之后」生效 = 属性版本快照**（`taskAttrFor / pushAttrHistory`，tasks 表 `history jsonb` 列）：编辑已生效过（昨天及以前）的任务时，把旧属性（title/points/required/category/hint/schedule/start_date/end_date/parent_id）追加成 `history` 快照 `{from,to,...}`（to = 昨天）；渲染一律「先按日期取版本、再判生效」——`tasksOnDate / dayTasksForProgress` 都是 `S.tasks.map(t => taskAttrFor(t, date)).filter(...)`，所以孩子端历史卡片、家长端历史清单、历史全清分母、`showTaskDetail(id, date)`、补卡记账（`checkin` 用当天版本的分值）、`confirmPending` 提示都用那天的属性。任务 id 不变 → 打卡记录、连续天数（`taskStreak`）、统计、待确认积分、图鉴全不受影响。**注意：`history` 是新列，改这里要同步 `sql/upgrade_all.sql`（已加 `add column if not exists history jsonb`），线上需跑一次 SQL，否则保存编辑会 PGRST204**
- **全清奖**：`isAllDone` / `cleanupAllClearPending`（异步，防重复）+ 模块级 `awardLocked` Set 防并发重复发（必选/可选全清 + 多日完成奖）；撤销提交/积分时连带清理待发奖励并释放锁定
- **任务详情 / 清单**：`showTaskDetail(id)`、`showProgressDetail(kind)`、`taskStatusOf(taskId, date)`
- **进化链**：`expThreshold / canEvolve / evolvePm / isMaxed / evoStageLabel`；图鉴家族 `evoFamily / dexGot / ownedNumbers`；`pkNoOf` 按名字兜底修老数据的 `pokedex_no`
- **多日进度**：`taskProgress / childWeight / childWeightMode / isTaskDoneEver`（权重优先分数 → percent → 条数均分）
- **喂养**：`openFeed(pmId)`（自定义分数 + 「刚好进化」）、`feedPm(pm, pts)`（喂完重开详情卡）
- **卡面**：`showCardDetail / showDexDetail / showDexMissing / movesBlockHTML / bindMoveClicks`；特效 `FX_BY_TYPE / fxKeyOf / cardFxHTML / cardGlitterHTML`
- **消息卡**：`pushNotice / noticesHTML / ackNotice`（存 `LK('notices')`）；触发点在 `giveBall / givePts / minusPts / confirmPending / applyOverduePenalty`
- **错误日志**：`reportError / showErrBanner / errorLogPanel / openErrorLog`（存 `LK('errors')`）
- **类别**：`allCategories / catSelectHTML / onCatSelectChange / readCat`（新建任务、编辑、多日布置都用同一套下拉）
- **常用任务**：`quickTasks / saveQuickList / openQuickEdit / openQuickAddTask / delQuick / bindQuickLongPress`（localStorage `km_quick_tasks`，每项 `{title,category,points,required,iconKey}`；图标 key 池在 `js/poke-icons.js` 的 `POKE_ICON_KEY_MAP`）。长按手势要用 `touchMode` 屏蔽合成的 mousedown/mouseleave，并在松手后吞掉那次合成 click，否则弹窗会被遮罩点击关掉
- **规则设置**：`SETTING_FIELDS`（app.js 顶部）+ `parentSettingsPanel / openSettings`
- **动画**：`showCatch / showEvolve / showShiny / showLevelUp / shareCard`（CSS 在 `style.css` 末尾）

## 六、可选下一步（用户提过/合理但未做）

- 高级球：250 分，稀有概率 15% → 50%（config 加一项即可）
- 音效：捕捉/进化/闪耀加 Web Audio 音效（"越炫越好"方向）
- 捕捉动画更丰富：多只候选、选择后的额外展示
- 家长端周报：每任务完成率曲线
- 招式表瘦身：目前 69KB 明文，可改为只存招式 ID + 运行时查表
- 每日积分上限防刷（个人使用需求不强）

## 七、协作约定（用户偏好，务必遵守）

1. **中文回复**
2. **改规则只动 config.js**，不要散落魔法数字；优先引导用「⚙️ 规则设置」
3. 动画/特效优先（"越炫越好"是明确要求）
4. 免费、纯前端优先，尽量不加后端
5. 手机输入友好（布置任务在手机上）
6. **验证方式**：改完让用户刷新浏览器看；自动化用 `node --check` + node `vm` 切函数跑单测 + fake-DOM 冒烟（本机 Edge headless 在沙箱里渲染不出内容，别浪费时间去跑无头浏览器；Playwright 与 Python 3.8 不兼容，**别升级 Python**）
7. 素材已全部打包，**不要重新下载**
8. **数据库 SQL 只更新 `sql/upgrade_all.sql` 一个文件**（幂等），用户只在 Supabase 运行它；不要新建 upgrade_vX 增量文件
9. 家长密码 2048；config 自动判断：localhost=演示数据、线上域名=真库
10. **前端字段 ↔ 数据库列必须对齐**：改 `js/db.js` 的 insert/update/select 字段时，同步核对 `sql/upgrade_all.sql`；改表结构同理要查前端。**踩过的坑（2026-10-20）**：`sup.addTask` 曾往 insert 里塞了 `note: null`，而 tasks 表没这列 → 线上正式模式添加任务全挂（PGRST204「找不到 note 列」）；demo(localStorage) 不校验 schema 所以本地正常，造成「demo 能加、正式不能加」的假象。修复 = SQL `add column if not exists note text` + db.js 入参去掉 note。**教训：demo 模式正常 ≠ 正式模式正常，涉及写库的改动必须用线上同款 payload 验证。**
11. 临时测试脚本（`_t.js` / `_smoke.js`）用完必须删，别留在仓库里；`tools/_cache_moves.json.tmp` 已被 `.gitignore` 忽略
12. **iOS 14 兼容（家里有旧 iPhone）**：Safari 14 不支持 `aspect-ratio`（图鉴格子/小卡框/详情卡大图靠它撑正方形，丢了就高度塌陷、图鉴不全、卡片乱）、`inset` 简写、无前缀 `backdrop-filter`。新加正方形容器时别只用 `aspect-ratio`，要用 `@supports not (aspect-ratio: 1 / 1)` + `padding-bottom` 兜底（style.css 末尾有现成模板）；全屏遮罩用 `inset: 0` 的要补 top/left/right/bottom
13. 部署：`git push` 到 `origin master` 即自动更新 GitHub Pages（`https://hhx0202.github.io/kimi_work/`）

## 八、开发验证技巧

- 本地：双击 `start.bat`（或 `python serve.py`）→ http://localhost:8000，控制台会打印手机访问地址
- 手机本地演示：手机和电脑连同一 WiFi，浏览器打开电脑打印的 `http://192.168.x.x:8000`；防火墙弹窗点允许
- 演示/推荐页：`intro.html`；重置试玩在家长中心 →「🎮 重置试玩数据」
- demo 模式数据存 localStorage（键 `km_*`；演示模式 `kmd_*`），可打开 DevTools → Application 直接改数据调试
- 切真实数据库：config.js 填 `SUPABASE_URL` / `SUPABASE_ANON_KEY`，先跑 `sql/upgrade_all.sql`（唯一建库脚本，幂等）——**本机线上库已跑过**
- **写库类改动必须验证完整链路**：仅测解析/渲染不够，要确认 app 实际发给 Supabase 的 insert 字段与表列一致（PGRST204 就是只测解析没测写库漏掉的）
- 单测写法：读 `js/app.js` 源码按函数名切片，丢进 `vm.createContext`，手工喂 `S`/`CONFIG`/`PK_*`，断言渲染出的 HTML 和状态；冒烟写法：按 `index.html` 的 7 个 `<script>` 顺序把文件拼起来跑，伪造 `document`/`localStorage`
- 改 CSS 后校验花括号数量（`grep -o` 统计 `{` `}`），改完 `node --check js/*.js`
