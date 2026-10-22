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

### 界面名词表（沟通时用这些词，避免歧义）

| 说法 | 指的界面 | 代码位置 |
|---|---|---|
| **图鉴 / 图鉴格** | 宝可梦页最下方的 151 格网格（未收集是剪影） | `dexHTML` / `.dex-grid` / `.dex-cell` |
| **我的宝可梦小卡**（别叫"大图"） | "我的宝可梦" 那一栏的卡片网格 | `renderPokemons` / `pmCardHTML` / `.pm-card-mini` |
| **卡牌详情 / 全屏卡** | 点小卡或图鉴格弹出的 PTCG 大卡。三种形态：**完整版**（手上正好有这一只：经验条/获取时间/出战/喂糖果/进化）、**只读版**（**进化过去的前置形态**：进化是改同一条记录，手上已没有小火龙这个个体，但 `dexGot()` 通过 `evoAncestors` 仍把它标为已收集 → 点它显示彩色卡+真招式+"同家族你拥有火恐龙"，无操作按钮/经验条。拥有闪耀形态时整条链（祖先+后代）都算已收集，也会出现只读版）、**剪影版**（图鉴未收集：灰色卡+？？？+锁住的招式；包括"还没进化到的后代形态"，例如只有火恐龙时点喷火龙） | `showCardDetail` / `showDexDetail` / `showDexMissing` / `.ptcg` / `#overlay` |
| **卡图 / 画框** | 卡牌详情中间那块正方形图（右上角按钮循环切换造型） | `.ptcg-art` / `cardArtSrc` |
| **立绘**（旧称"原画"） | 官方高清立绘 PNG（475×475，透明底、全身、无背景无文字），所有卡默认显示；**闪耀卡默认也显示立绘**（官方没有异色版立绘）。别和 TCG 的"卡面插画/场景插画"混用 | `assets/artwork/{no}.png` / `artworkPath` |
| **异色动图** | 官方像素精灵 GIF（50×46，会动）的 shiny 版；只有闪耀卡的详情能切到 | `assets/sprites/shiny/{no}.gif` / `spritePath(no, true)` |
| **场景卡** | 整张**中文卡面**（不裁切，卡名/技能都是中文），普通卡和闪耀卡都能切 | `assets/scenes/{no}.jpg` / `scenePath` |
| **捕捉 / 进化 / 闪耀动画** | 全屏动画 | `showCatch` / `showEvolve` / `showShiny` |
| **喂养弹窗** | 点"喂糖果"后的弹窗 | `openFeed` |
| **分享卡** | "生成成就图" | `shareCardHTML` |

**用法示例**："在**卡牌详情**右上角加按钮"、"**我的宝可梦小卡**的编号太小"、"**图鉴格**里闪耀角标换位置"、"**卡图区域**加边缘渐隐"。避免单独说"大图/卡片"——小卡、详情卡、图鉴格都容易被理解成"卡片"。

## 三、技术架构速览

- **纯静态前端**：无构建、无 node_modules，双击 `start.bat`（或 `python serve.py`）起服务器即可跑
- **免后端**：前端直连 Supabase（publishable key），所有逻辑在浏览器
- **部署**：**两套并存**——① Cloudflare Pages（`kimi-work.pages.dev`，国内主力，push master 由 GitHub Actions 自动部署）② GitHub Pages（`hhx0202.github.io/kimi_work/`，海外/备用；国内实测 2.7 KB/s，图片加载不出来）。EdgeOne Pages 已弃用（域名随机，后返回 401）。**注意 `*.workers.dev` 在国内被 DNS 污染（解析到 Facebook 的 `face:b00c`），只能用 `*.pages.dev`**
- **发布产物**：只含 `index.html intro.html css js assets` 五项；仓库根目录含 `.git`（31MB pack，超 Cloudflare 25MiB 单文件上限）和 `sql`/`.workbuddy` 等不该公开的内容
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
- **assets 目录**：
  - `assets/artwork/{编号}.png` — 151 张官方立绘（475×475，透明底）
  - `assets/sprites/normal/{编号}.gif`、`assets/sprites/shiny/{编号}.gif` — 各 151 张像素动图（50×46）
  - `assets/scenes/{编号}.jpg` — 151 张**中文场景卡**（整张中文卡面，压到 400×600 内、q82，约 50–80KB/张；来源见 `tools/fetch_scenes.py`）
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
| 跨设备轮询间隔 `POLL_SECONDS` | 20 秒（0=关闭轮询） | —（技术项，只在 config.js） |
| 买球价 `BALL_PRICE` | 100 | ✅（已在 SETTING_FIELDS） |
| 稀有概率 `RARE_PROBABILITY` | 0.15 | — |
| 默认类别 `DEFAULT_CATEGORIES` | 校内/校外/作业/打卡/阅读/运动/家务/英语/数学/音乐/练字/编程 | — |

> **注意**：`EVO_EXP_1/2`、`SHINY_EXP` 已进 `SETTING_FIELDS`（见 app.js 顶部），改规则优先教家长用「⚙️ 规则设置」，别直接改代码；代码里的值只是默认值。

## 五、关键实现位置（改哪儿找哪儿）

- **任务渲染/排序**：`renderTasks / catSectionHTML / taskCardHTML / taskSort`；列表按查看日期渲染（`tasksOnDate(S.viewDate)`，翻历史显示那天的任务，别改回 `todayTasks()`）；属性按日期取版本（`taskAttrFor`）；进度用 `dayTasksForProgress(date)`（任务不再因完成而下架，列表不过滤 active，已完成/待审核都保留；该函数仍保留打卡记录兜底兼容历史下架数据）。历史日期只读：未完成显示禁用按钮「未完成」（不是可点的「查看历史」）。**顺序持久化统一走 `persistTaskOrder(orderedIds)`**（家长端长按拖动 `saveSort` 与 ↑↓ 按钮 `moveTask` 共用）：只写 sort 真正变化的行、并发落库、本地立即生效后由调用方 `render()`，不再全量重写 + 逐条 await + `refreshAll()`
- **打卡链路**：`checkin`（**乐观更新**：先改本地 `S.logs` 立即渲染按钮变「已提交」，DB 写入放 `bgWrite` 后台落库，失败才提示错误；打卡记账日期用 `day = S.viewDate`（补卡）或今天）→ `cancelSubmission`（撤销）→ `confirmPending`（审批发分）→ `undoPoint`（撤销已发分）
- **写库两条铁律（2026-10-21 实测 Supabase 单次往返 0.5~2.8s）**：①**互不依赖的写入一律 `Promise.all` 并发**，别写成串行 await（串行 4 次≈4.5s、并发 4 次≈2.0s）；②**交互一律乐观更新**——先同步改本地 `S` + 立即渲染，把写库丢进 `bgWrite`（失败 toast + 错误日志），**不要 `await` 完再渲染**，否则按钮要等 1~3 秒才有反应。已改造：`checkin` 三段、`cancelSubmission`（`dropAllClearPending` 同步回收全清奖）、`confirmPending`、`undoPoint`、`givePts / minusPts / giveBall / buyBall`。需要库返回 id 才能进本地列表的（发分/扣分/买球），先在后台拿到 id 再 push + 补一次 render。**新增交互时沿用这两条**；只有"父任务先建、子任务要 parent_id"这类真依赖才允许串行。例外：多日任务的子任务批量创建（`addTask` 循环）保持串行以保留家长输入的展示顺序
- **补卡**：`isMakeupDate / makeupDays`（config `MAKEUP_DAYS`，默认 1）。孩子端翻到补卡窗口内的历史日期时，漏掉的**单次任务**显示「⏪ 补完成」（重复/子任务不可补；单次任务已完成过任何一天也不能再补，`isTaskDoneEver` 防重复领分）。补交记录写到那天（积分流水 `log_date` 也是那天，家长端待确认面板按日期分组照常审批），**不发当天的必选/可选全清奖**（`awardReq/awardOpt` 在补卡分支被跳过）；补卡期内单次任务的待审批提交可撤销（撤了可再补），重复任务的历史提交不可撤销（撤了没法重新提交）。连续全清（streak）按打卡记录自然计算，补卡补齐的那天会计入连击但无全清奖分
- **打卡日历（2026-10-22 重做）**：孩子端「我的」页只保留**全清日历**，顶部两个**文字按钮**切换「必做全清 / 选做全清」（`S.calDim`，选中态靠 `.cal-tab.req/.opt` 的整块红/绿底区分，**别用 🔴🟢 圆点图标**——圆点在日历格里已经表示完成状态，同一面板里同色不能两义），日历下方有一行 `.cal-legend` 圆点图例集中说明颜色，下拉选单个任务和下方「打卡记录」清单都删掉了（日历里够看，且下拉只列今天的重复任务、越用越乱）。**关键修复：分母按天算** —— `calTasksOn(date, dim)` = `dayTasksForProgress(date)` 再按必做/选做筛，`calDayStat(date, dim)` 给出 `{total, done, full}`。之前用 `S.tasks.filter(t => t.schedule === 'daily')`（今天的任务列表）去算历史每一天，今天新加的重复任务会把昨天/前天的分母撑大，孩子明明全做了也只显示**黄点**、永远认不出全清——和连击断掉是同一个根因。绿点=全清、黄点=做了一部分、红点=一条没做、**灰点=那天本来没有这类任务**（还没布置/已停用），别把灰点和"没做"混为一谈。测试见 `tests/calendar.test.js`。**未来日期不判成败**（`ds > todayStr` → 淡色 + 虚线圆点 + "还没到"），否则月初打开满屏红点像在说孩子没做
- **「我的」页结构（2026-10-22 整合，从 10 块压到 5 块）**：① 顶部 `.me-head` 一个区域放 4 张数字卡片——当前积分 / 累计获得积分（`earnedPoints()`，正向流水含待确认）/ 累计完成任务（`totalDoneCount()`，所有任务类型）/ 必做全清连击，右下角一个小按钮「📸 生成成就图」；② 打卡日历；③ 任务提交；④ 积分记录（`kidPointLogPanel()`，`S.ptFilter` = all/plus/minus 三个胶囊筛选）。**已删除**：完成统计整块（含 `statDim` 维度选择器，选择器随日历下拉一起删掉后已成死控件）、宝可梦/图鉴卡片、`approvedPointsHTML`（家长确认积分，与积分记录重复）、`bonusLogsHTML` / `minusLogsHTML`（合并进积分记录）、`catch-zone` 里的「去捕捉宝可梦」（底栏已有入口）。「完成统计的说明行」也不要了。**家长端**的 `checkinLogPanel` / `showTaskLogs` 面板整块删除
- **重复任务从布置当天起生效（2026-10-22 修复）**：之前 `daily` 任务布置时 `start_date` 写 `null`，而 `inEffect` 把空值当"从最早开始生效"，于是**今天新加的重复任务会被算进昨天/前天的必做分母**，孩子昨天明明全清也会被判成没做完 → 连击直接断掉（用户实测遇到）。现在：① 新增重复任务 `start_date = S.parentDate`（`end_date` 仍为 null）；② 编辑里「改成重复」和「子任务取消关联恢复独立每天」也写 `start_date = 今天`；③ 老数据（早期版本建的、`start_date` 为空）在 `inEffect` 里用 `created_at` 兜底：`schedule === 'daily' && !start_date && created_at` → 布置日之前不算生效。连击口径**以孩子提交为准**（`reqDayDone` 只看 `done === true`，不看 `approved`），回调了用户确认不改。测试见 `tests/streak.test.js`
- **删除重复任务 = 软停用**（`delTask`）：daily 任务删除改为 `updateTask(id, { end_date: 昨天 })`，不硬删。之前日期照常显示任务卡/打卡状态/全清判定（`inEffect` 按日期过滤，家长端清单本来就按 `S.parentDate` 渲染，无需额外处理）；今天起不再出现；历史统计（`doneStats`）和打卡记录面板照常（任务仍在表里）。`sameTitleTask` 会跳过已结束（`end_date < 今天`）的任务，停用后可再建同名任务。单次/子任务/多日删除仍是硬删（行为未变）。无需改 db.js/SQL（end_date 列早已存在）
- **编辑只对「今天及之后」生效 = 属性版本快照**（`taskAttrFor / pushAttrHistory`，tasks 表 `history jsonb` 列）：编辑已生效过（昨天及以前）的任务时，把旧属性（title/points/required/category/hint/schedule/start_date/end_date/parent_id）追加成 `history` 快照 `{from,to,...}`（to = 昨天）；渲染一律「先按日期取版本、再判生效」——`tasksOnDate / dayTasksForProgress` 都是 `S.tasks.map(t => taskAttrFor(t, date)).filter(...)`，所以孩子端历史卡片、家长端历史清单、历史全清分母、`showTaskDetail(id, date)`、补卡记账（`checkin` 用当天版本的分值）、`confirmPending` 提示都用那天的属性。任务 id 不变 → 打卡记录、连续天数（`taskStreak`）、统计、待确认积分、图鉴全不受影响。**注意：`history` 是新列，改这里要同步 `sql/upgrade_all.sql`（已加 `add column if not exists history jsonb`），线上需跑一次 SQL，否则保存编辑会 PGRST204**。**范围约定（2026-10-21 与用户确认）**：子任务/多日任务不做属性版本化，改分后多日进度按最新分重算属于预期行为，别当 bug 修；版本化只针对重复/单次这类按天布置的任务
- **全清奖**：`isAllDone` / `dropAllClearPending(date)`（同步回收本地待发全清奖并返回要删的流水 id，删除动作并进 `cancelSubmission` 的后台并发波）+ 模块级 `awardLocked` Set 防并发重复发（必选/可选全清 + 多日完成奖）；撤销提交/积分时连带清理待发奖励并释放锁定
- **任务详情 / 清单**：`showTaskDetail(id)`、`showProgressDetail(kind)`、`taskStatusOf(taskId, date)`
- **进化链**：`expThreshold / canEvolve / evolvePm / isMaxed / evoStageLabel`；图鉴家族 `evoFamily / dexGot / ownedNumbers`；`pkNoOf` 按名字兜底修老数据的 `pokedex_no`。**数据完整性由 `tests/pokemon-data.test.js` 守护**：扩充图鉴/改进化链后跑 `node tests/run.js`，如果进化目标不存在、某条链追溯不到基础形态、或有进化形态无法从捕捉池获得，测试会失败并列出具体编号
- **多日进度**：`taskProgress / childWeight / childWeightMode / isTaskDoneEver`（权重优先分数 → percent → 条数均分）
- **喂养**：`openFeed(pmId)`（自定义分数 + 「刚好进化」）、`feedPm(pm, pts)`（喂完重开详情卡）
- **卡面**：`showCardDetail / showDexDetail / showDexMissing / movesBlockHTML / bindMoveClicks`；特效 `FX_BY_TYPE / fxKeyOf / cardFxHTML / cardGlitterHTML`
- **卡牌详情的造型切换**（2026-10-22，`cardArtSrc / cycleCardArt / currentCardArtMode`）：右上角按钮循环切换 **立绘 →（闪耀卡）异色动图 → 场景卡 → 立绘**；普通卡只有「立绘 / 场景卡」两档（存了 sprite 也会回退立绘）。选择存本机 `km_card_art_mode`（浏览偏好，不跨设备）。场景卡 = 整张中文卡面（不裁切），切到场景卡时进入 `scene-mode`：只隐藏 App 自己的招式区 `ptcg-moves` 和图鉴介绍 `ptcg-flavor`（卡面本身都印了），**顶部名字行 `ptcg-top` 保留**（宝可梦名字 / ✨闪耀形态 / 阶段是 App 侧的身份信息，卡面没有），卡图框改 `aspect-ratio: auto` 按图片自身比例撑高（素材统一 400×559），**卡面宽度不许单独改，继承 `.ptcg` 的 `min(320px, 90vw)`**——切造型时整张卡不能变宽，否则页面会跳、图片在更宽的框里显胖，`tests/ui-guards.test.js` 有守，底部经验条/进化链/按钮保留；属性粒子与角标也隐藏避免挡字；卡图铺满后造型按钮会压住卡面右上角的 HP/属性，所以 `.ptcg.scene-mode .ptcg-top` 加 `margin-bottom: 40px` 在名字行下方留出一条空带、按钮上移到 `top: -32px`（只动纵向，不动宽度/左右 padding，图片比例不受影响）；iOS 14 的 `@supports not (aspect-ratio)` 兜底里要单独把 `.ptcg.scene-mode .ptcg-art` 的 `padding-bottom` 归零（否则底下多一大块空白）。图片缺失时 `onerror` 回退立绘。切换只改这一张图和特效层，不重播整卡动画。**闪耀卡 + 场景卡**：金色卡框和光效都要保留——`.ptcg.shiny-card` 的外层呼吸光晕本来就在，另外加了 `.ptcg.shiny-card.scene-mode .ptcg-art` 金边 + `shiny-scene-glow` 图片金光呼吸（不用 `art-float` 浮动，整张卡面上下漂会显得比例在飘），星光层 `cardGlitterHTML(tall)` 在场景卡里也保留（落点按更高的卡面重算，切换时用 `retuneGlitter` 更新），只有属性粒子和属性角标在场景卡里隐藏（会盖住卡面上的字）
- **闪耀形态的视觉**：小卡金色呼吸边框 + 全息扫光层（`.pm-card-mini.shiny .mini-frame::after`）+ 右上角 ✨；详情卡整卡金色呼吸光晕（`.ptcg.shiny-card`）+ 全息/星屑。**默认看到的是"普通配色的立绘 + 闪耀特效"**（官方没有异色版立绘），异色配色只在「异色动图」里
- **闪耀沿进化链继承**（2026-10-22，`shinyLineageNo / willInheritShiny`，`tests/shiny-inherit.test.js` 守）：闪耀卡用在**基础形态**上之后，这条链就有了"闪耀血统"——之后**普通卡进化**出来的形态也直接是 ✨（`evolvePm` 里 `willShiny = pm.shiny || willInheritShiny(pm, toNo)`，`DB.updatePokemon` 连 `shiny` 一起落库，动画也放闪耀形态的图），详情页会提前写「进化出来直接是闪耀形态」。三条边界：① 只**向后**继承（✨ 只在后面的形态 → 前面的基础卡进化不做成闪耀，避免倒着传染）；② 目标编号已经有 ✨ 卡时不再生成第二张（同族同编号只留一张 ✨，`hasShinyCopy`）；③ 血统判定是**个体数据推导**出来的（看 `S.pokemons` 里祖先有没有 shiny），没有新增数据库字段，老数据自动适用。**文案口径统一成「这条进化链上的宝可梦都会变成 ✨」**（`.shiny-bar`、小抄、`applyShinyCard` 的动画副标题都一样），别只写"进化出来的形态"，孩子会以为前面几阶没份；选卡态小卡上的按钮是「闪耀吧！✨」（`.mini-pick`，10px 以内不会顶出卡面）
- **场景卡素材来源**（2026-10-22）：`tools/fetch_scenes.py` 从神奇宝贝百科（wiki.52poke.com）的 `151C001.png … 151C192.png` 批量抓取（中文卡面），校验完整性后压成 400×600 内的 JPEG 存到 `assets/scenes/{图鉴编号}.jpg`（001–151 与图鉴编号一一对应）。**仅家庭自用**，卡图版权归官方所有，别公开分发。脚本支持 `--from/--to/--workers` 和断点续传（已有且能打开的文件会跳过）；源站限速严重时会比较慢
- **宝可梦列表排序**（`pmSortMode / setPmSort / pmSortList / openPmSortPicker`，2026-10-22）：`我的宝可梦` 标题右侧「↕ 排序」按钮打开选项弹层，六选一——捕获顺序（默认）/ 捕获倒序 / 编号顺序 / 属性（按 `TYPE_THEME` 键顺序，同属性内按编号）/ **阶段升序（基础→一阶→二阶）/ 阶段降序**；阶段 = `evoStage()`（进化阶段，卡牌里叫「基础 / 1阶进化 / 2阶进化」），同阶段内按图鉴编号，`pkNoOf` 查不到编号的老数据永远排最后；选择存**本机 localStorage**（`LK('pm_sort')`，是设备上的浏览偏好，刻意不跨设备）；没有 `caught_at` 的老数据在按时间排序时永远排最后。小卡第一行现在是「#编号 + 属性 + 名字」，右下角阶段角标 `evoStageLabel` 对闪耀卡写成「✨基础 / ✨一阶 / ✨二阶」（只加 ✨ 前缀，不再整个换成 ✨，否则按阶段排序看不出档位）
- **宝可梦页顶部（2026-10-22 精简）**：`catchZoneHTML` 只留一行「精灵球 ×N + 小球图标（最多 10 个，多的写 +N）」和**两个并排按钮**「捕捉」「买球 100 分」（`.catch-actions` 是两列 grid，≤360px 只收字号，别改回上下两行堆叠）；原来那行长规则说明 `.catch-hint` 和「出战伙伴 +经验」一行都删了，合并成和任务页同一套 `<details class="rules-hint">` 折叠小抄 `pokeRulesHTML()`（默认收起）。**捕捉和买球都要二次确认防误点**：`catchOne` 在真正扣球前 `askConfirm`（写清"要花 1 个精灵球 / 现在有几个"），`buyBall` 扣分前 `askConfirm`（写清"花多少分 / 买完剩多少"）；球不够、基础形态已抓齐时**不弹**确认；弹窗停留期间别的设备可能改了数据，所以确认后还要再判一次
- **「我的」页明细列表滚动**：`.log-list` 固定 `max-height: 340px` + `overflow-y: auto`（任务提交/积分记录共用），记录再多也只占一屏；改样式时别把 `overflow` 改回 `hidden`（`tests/ui-guards.test.js` 有守）
- **消息卡**：`pushNotice / noticesHTML / ackNotice`（存**共享存储** `settings.notices`，见下条）；触发点在 `giveBall / givePts / minusPts / confirmPending / applyOverduePenalty`
- **跨设备轮询**（`pollOnce / pollBusy / preserveScroll / startPoll` + `DB.getRev`，config `POLL_SECONDS` 默认 20，0=关闭）：`getRev()` 只做 5 个极轻的只读查询（task_logs/point_logs/tasks 各取主键倒序 limit 1 + notes 最新一条 + settings.rev）拼成版本串；`sharedSet` 写入时顺手更新 `settings.rev`，所以任何共享数据变更都能被探到。**调度规则：演示模式不轮询；页面不可见不轮询；`pollBusy()` 为真就跳过这一轮**（有 `.modal-mask` 弹窗 / `#overlay` 未 hidden（捕捉进化动画、宝可梦卡牌）/ `.dragging` 拖动中 / 输入框有焦点 / `#app` 里有没提交的输入内容）。刷新时用 `preserveScroll` 保住**滚动位置 + 折叠面板展开状态**。改动轮询务必保持"没在操作才刷、刷完保住现场"，`tests/poll.test.js` 就是守这条的
- **跨设备共享的小数据**（`sharedGet / sharedSet / migrateLocalToShared`，2026-10-21）：常用任务、自定义类别+隐藏类别、家长消息卡、出战宝可梦、领奖标记都存在 `settings` 表的键值里（value 是 text，内容为 JSON 字符串），家长手机和孩子平板看到同一份；内存镜像 `SHARED` 是真源，`refreshAll` 时随 settings 一起拉回，写入一律"本地立即生效 + `bgWrite` 后台落库"。**老数据搬家**：`migrateLocalToShared` 只在共享里还没有该项时才把本机 localStorage 的老值传上去（不覆盖别的设备已改的值）。**刻意不共享**：错误日志 `LK('errors')`（同步会"写失败→记错误→再写失败"自激）、身份 `role`、家长免密 `parent_authed`、积分提示已读 `seen_pts`（都是"这台设备"的语义）。**关于"实时"**：本应用是**拉取式**同步（没有 WebSocket 推送）。跨设备可见性靠 `pollOnce`（见下条）轻量轮询：家长手机上的改动，孩子端最多 `POLL_SECONDS`（默认 20 秒）后自己刷新出来；切回前台时会立刻探一次。**注意：存储位置（本地/库里）决定的是"能不能跨设备看到、清缓存会不会丢"，实时性取决于变更通知机制**——不要把这两件事混为一谈demo 模式的 `setSettings` 已改成按 key 合并（与 supabase upsert 一致），别改回整体覆盖
- **错误日志**：`reportError / showErrBanner / errorLogPanel / openErrorLog`（存 `LK('errors')`）。**安卓切回前台报一堆 "Script error."（2026-10-22 已修）**：这是跨域脚本里的错误被浏览器脱敏后的样子（拿不到文件名/行号）。根因是 supabase-js 默认开着 Auth 的 `autoRefreshToken`，页面 `visibilitychange` 切回前台时会恢复会话、读写 localStorage，那段代码在 CDN 里，出错只能报 "Script error."。**本项目根本不用 Auth**，所以 `sClient()` 已设 `{ auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }`；同时给 3 个 jsdelivr 脚本加了 `crossorigin="anonymous"`（jsdelivr 返回 `access-control-allow-origin: *`），以后 CDN 脚本再报错就能看到真实信息。**别把 Auth 配置改回去**。
  - **2026-10-22 复查：线上仍是 `Script error.`（说明还有别的跨域来源，比如浏览器扩展/App 内置 WebView 注入）**。为此补了两层"现场信息"：① `index.html` 里在任何外部脚本**之前**、用 capture 挂了一个 `window.__earlyErrors` 监听（CDN 脚本自己报错时 app.js 还没加载，必须提前挂），启动时由 `DOMContentLoaded` 收进错误日志；② `envSnapshot()` 在每条脚本错误里附带 UA、页面路径、`document.lastModified`（判断手机是否在跑旧版本）、可见性、在线状态、屏幕尺寸、外部脚本域名、三个 CDN 依赖是否就绪（`supabase/confetti/html2canvas`）、访问过的近期早期错误，以及"是否在切回前台 10 秒内"（`visibilityHint`）。跨域的 `Script error.` 单独归为「脚本错误（跨域，无详情）」。`reportError` 的 `extra` 容量从 240 提到 900 字。下次手机再弹错误，让家长端点「详情 → 复制」发来即可定位。
  - **实测结论（2026-10-22 17:05 那条日志）**：`外部脚本=cdn.jsdelivr.net`、`就绪=supabase:是,confetti:是,html2canvas:是`、三个 CDN 都带 `crossorigin` → **这条无文件名的跨域错误不是页面自己加载的脚本抛的**，是页面里其他跨域脚本（浏览器/输入法/App WebView 注入之类）抛的；`可见=hidden` 说明发生在页面切到后台期间。于是再加三类现场：`脚本标签=N(外域:…)(内联N)` + `已加载脚本域=`（`performance.getEntriesByType('resource')`，能抓到动态插入后又移除的脚本）、`加载后=Ns`、`导航=刷新/前进后退恢复/正常打开`。同时修掉重复记录：`index.html` 的早期监听在 `window.__kmAppReady` 置位后不再写入，避免同一条错误既记「早期错误」又记「脚本错误」
- **类别**：`allCategories / catSelectHTML / onCatSelectChange / readCat`（新建任务、编辑、多日布置都用同一套下拉）
- **常用任务**：`quickTasks / saveQuickList / openQuickEdit / openQuickAddTask / delQuick / bindQuickLongPress`（localStorage `km_quick_tasks`，每项 `{title,category,points,required,iconKey}`；图标 key 池在 `js/poke-icons.js` 的 `POKE_ICON_KEY_MAP`）。长按手势要用 `touchMode` 屏蔽合成的 mousedown/mouseleave，并在松手后吞掉那次合成 click，否则弹窗会被遮罩点击关掉
- **规则设置**：`SETTING_FIELDS`（app.js 顶部）+ `parentSettingsPanel / openSettings`
- **动画**：`showCatch / showEvolve / showShiny / showLevelUp / shareCard`（CSS 在 `style.css` 末尾）
- **朋友圈成就图**（`shareCard / shareCardHTML`，2026-10-22 加固）：以前 `shareCardHTML()` 和 `appendChild` 在 try 外面，一旦老数据（出战宝可梦 `pokedex_no` 丢了/是脏值）在拼 HTML 时抛错，就变成"点了没反应"——现在**整段都在 try 里**，并且**点下去立刻把 `#overlay` 打开显示「正在生成成就图…」+ 转圈**（`share-spin`），成功后替换成图片，失败则写进错误日志（`reportError('生成成就图失败', …)`）+ toast 显示原因；`shareBusy` 防连点；出战编号统一走 `pkNoOf(lead) || 25` 兜底（名字也按兜底后的编号取）。html2canvas 没加载出来会明确提示"需要联网"，不再静默

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
11. **测试写进 `tests/`（常驻，别再用临时脚本）**：`node tests/run.js` 一键跑全部用例（2026-10-21 起，130+ 断言）。新增/改动核心逻辑时**先补一个 `tests/*.test.js` 用例再改代码**，用 `tests/harness.js` 的 `makeCtx(函数名数组, 全局覆盖)` 从 `js/app.js` 切真实函数进 vm 沙箱（`laggyDB(lag)` 造带往返延迟的假库、`runBg(ctx)` 手动驱动后台写库以便断言"渲染先于落库"）。临时脚本（`_t.js` / `_smoke.js`）用完仍必须删；`tools/_cache_moves.json.tmp` 已被 `.gitignore` 忽略
12. **iOS 14 兼容（家里有旧 iPhone）**：Safari 14 不支持 `aspect-ratio`（图鉴格子/小卡框/详情卡大图靠它撑正方形，丢了就高度塌陷、图鉴不全、卡片乱）、`inset` 简写、无前缀 `backdrop-filter`。新加正方形容器时别只用 `aspect-ratio`，要用 `@supports not (aspect-ratio: 1 / 1)` + `padding-bottom` 兜底（style.css 末尾有现成模板）；全屏遮罩用 `inset: 0` 的要补 top/left/right/bottom
13. 部署：**两套并存，push 一次同时更新**——① GitHub Pages（`https://hhx0202.github.io/kimi_work/`，海外/备用）② GitHub Actions 自动构建部署到 Cloudflare Pages（`https://kimi-work.pages.dev`，国内主力，workflow 见 `.github/workflows/deploy-pages.yml`）。**Cloudflare 那边的发布目录必须是只含 `index.html intro.html css js assets` 的子目录**（仓库根会被 `.git` 里 31MB 的 pack 撞上 25MiB 单文件上限，还会公开 `.git`/`sql`/`.workbuddy`）。EdgeOne Pages 已弃用（域名随机、后返回 401）。若将来把仓库改为私有，GitHub Pages 会失效（免费账号需 Pro），Cloudflare Pages 不受影响。

## 八、开发验证技巧

- 本地：双击 `start.bat`（或 `python serve.py`）→ http://localhost:8000，控制台会打印手机访问地址
- **本地服务器已禁用缓存**（`serve.py` 的 `NoCacheHandler` 发 `Cache-Control: no-store`，并忽略 `If-Modified-Since` 不返回 304），改完代码普通刷新就能看到新版本。若仍看到旧界面：先**重启**服务器（旧进程还在发缓存头），再在浏览器强刷一次（安卓没有硬刷新快捷键，最省事是开一个**无痕标签页**）
- **启动自动清理旧服务器**：关终端不一定杀掉 `serve.py`，再次启动会 `Address already in use`。`serve.py` 里的 `free_port()` 会先找本项目的旧 `serve.py` 并停掉（Linux 扫 `/proc` 按「python 进程 + 命令行 serve.py + 工作目录是本项目」认人；读不到 cwd 的沙箱环境退回「相对路径 serve.py」判断；Windows 用 netstat + PowerShell 查命令行；macOS 用 lsof + ps）。只杀自己的进程，端口被别人占用时明确报错退出。`port_in_use()` 用 `SO_REUSEADDR` 判断，避免把 TIME_WAIT 误当成占用
- 手机本地演示：手机和电脑连同一 WiFi，浏览器打开电脑打印的 `http://192.168.x.x:8000`；防火墙弹窗点允许
- 演示/推荐页：`intro.html`；重置试玩在家长中心 →「🎮 重置试玩数据」
- demo 模式数据存 localStorage（键 `km_*`；演示模式 `kmd_*`），可打开 DevTools → Application 直接改数据调试
- 切真实数据库：config.js 填 `SUPABASE_URL` / `SUPABASE_ANON_KEY`，先跑 `sql/upgrade_all.sql`（唯一建库脚本，幂等）——**本机线上库已跑过**
- **写库类改动必须验证完整链路**：仅测解析/渲染不够，要确认 app 实际发给 Supabase 的 insert 字段与表列一致（PGRST204 就是只测解析没测写库漏掉的）
- 单测写法：读 `js/app.js` 源码按函数名切片，丢进 `vm.createContext`，手工喂 `S`/`CONFIG`/`PK_*`，断言渲染出的 HTML 和状态；冒烟写法：按 `index.html` 的 7 个 `<script>` 顺序把文件拼起来跑，伪造 `document`/`localStorage`
- 改 CSS 后校验花括号数量（`grep -o` 统计 `{` `}`），改完 `node --check js/*.js`
