# 🤖 Kimi 任务岛 - 远程接口说明（给 agent 用）

> 本文件是给**本地 agent / AI 助手**调用的接口规范。家长把一句话任务描述发给 agent，
> agent 按本规范解析成结构化指令，调用 Supabase REST API 直接增删改任务。无需写后端、无额外费用。

---

## 一、接口基础

项目已用 Supabase 数据库，自带 REST API（PostgREST）。

- **Base URL**：`https://ipitcujpkfszghngfzwp.supabase.co/rest/v1`
- **鉴权方式**（每个请求都带这两个 Header）：
  ```
  apikey: <KEY>
  Authorization: Bearer <KEY>
  Content-Type: application/json
  ```
- **KEY 从哪拿**：Supabase 控制台 → Project Settings → API → 有 `anon public` 和 `service_role` 两个 key。
  - **推荐 agent 用 `service_role` key**：完整权限、绕过所有行级安全（RLS），增删改查都畅通。
  - **警告**：`service_role` key 等同于数据库管理员钥匙，**只能存在 agent 本地**（环境变量/配置文件），
    **绝不能**写进前端代码、提交到 GitHub 或放进任何公开页面。前端只用 `anon` key。

---

## 二、任务字段表（tasks 表）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `title` | text | ✅ | 任务名称，如「语文作业」 |
| `category` | text | 否 | 类别，默认 `打卡`；会自动出现在孩子端分区 |
| `points` | int | 否 | 积分 1~100，默认 10 |
| `schedule` | text | 否 | `daily`每天出现 / `once`只做一次 / `weekly`本周长期任务 / `child`子任务 |
| `required` | bool | 否 | `true`必选 / `false`可选，默认 true |
| `start_date` | date | 否 | 绑定的日期（`YYYY-MM-DD`）。配合 `once` 表示「只在这一天出现」 |
| `end_date` | date | 否 | 绑定的结束日期。单日专属任务时 = `start_date` 同值 |
| `deadline` | date | 否 | 多日任务的截止日期 |
| `parent_id` | bigint | 否 | 子任务所属的父任务 id |
| `percent` | int | 否 | 旧版子任务百分比（新逻辑按分数计，可忽略） |
| `hint` | text | 否 | 家长小提示，孩子端展示（如「先复习生字」） |
| `sort` | int | 否 | 孩子端展示顺序权重（家长端 ↑↓ 调整，默认 0） |
| `active` | bool | 否 | 是否启用，默认 true（`false`=软删除/已完成下架） |

**多日任务规则**：
- 子任务（`schedule:child`）各自带独立 `points`（分数），完成即得自己的分数；父任务总分 = 子任务分之和，进度按已得/总分算
- 多日任务全部子任务完成 → 自动关闭，并额外 +`WEEKLY_DONE_BONUS`（默认 10 分，reason `多日完成奖:标题`）
- 多日任务超期（超过 `deadline`）→ 每天自动扣 `OVERDUE_DAILY_PENALTY`（默认 5 分，reason `多日超期:标题`，从截止次日算起补扣）
- 任务标题末尾可用 `{花括号}` 圈住提示 → 存入 `hint` 字段，如 `语文作业{先复习生字}`

---

## 三、核心概念：按日期布置「每天专属任务」

家长的需求是**直接规划好每天各自做什么**（周一语文、周二英语、周三阅读……每天不同）。

实现方式 = **`once` 任务 + `start_date`**（`end_date` 填同一天）：

- `schedule: 'once'` + `start_date: '2026-10-20'` → 任务只在 **10 月 20 日**那天出现在孩子端，做完即自动下架
- 没有 `start_date` 的 `daily` 任务 → 每天出现（如「每天语文作业」，家长用「自动识别」布置的那类）

所以规划「一周不同计划」= 发多个任务，各自带不同的 `start_date`。

---

## 四、增删改查示例（curl）

### 1️⃣ 查询任务

```bash
# 查全部
curl "$BASE/rest/v1/tasks?select=*&order=id.asc" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"

# 查单个（按 id）
curl "$BASE/rest/v1/tasks?select=*&id=eq.42" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"

# 查某天要出现的任务（daily 每天都有 + once 当天专属）
curl "$BASE/rest/v1/tasks?select=*&active=eq.true" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

### 2️⃣ 新增任务（POST，单个或数组）

```bash
# 布置「10-20 语文作业 10 分」（当天专属）
curl "$BASE/rest/v1/tasks" \
  -X POST \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "title": "语文作业",
    "category": "校内作业",
    "points": 10,
    "schedule": "once",
    "required": true,
    "start_date": "2026-10-20",
    "end_date": "2026-10-20"
  }'

# 批量布置一整周（周一~周五每天不同）：直接发数组
curl "$BASE/rest/v1/tasks" \
  -X POST \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '[
    {"title":"语文作业","category":"校内作业","points":10,"schedule":"once","start_date":"2026-10-20","end_date":"2026-10-20"},
    {"title":"英语作业","category":"校内作业","points":10,"schedule":"once","start_date":"2026-10-21","end_date":"2026-10-21"},
    {"title":"跳绳500个","category":"运动","points":5,"schedule":"once","required":false,"start_date":"2026-10-20","end_date":"2026-10-20"}
  ]'
```

> 插入成功返回的 JSON 里有 `id`（自增主键），记得回读保存，后面改/删要用。

### 3️⃣ 修改任务（PATCH，按 id）

```bash
# 改积分 / 软删除（最常用）
curl "$BASE/rest/v1/tasks?id=eq.42" \
  -X PATCH \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"points": 15, "active": false}'
```

### 4️⃣ 删除任务（DELETE，按 id，慎用）

```bash
curl "$BASE/rest/v1/tasks?id=eq.42" \
  -X DELETE \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

> **删 weekly 父任务前，先删它的子任务**（`parent_id=eq.该id`），否则会留下孤儿子任务。
> 常规情况建议用软删除（`active:false`）代替真删，保留打卡历史。

---

## 五、文字 → 指令转换规范（agent 解析规则）

家长发来一段自然语言，按下面规则转成 JSON 再调接口。

**1. 拆任务**：每一行（或「，」/「、」/「和」/「还有」分句）是一个任务，格式 `名称, 类别, 分数, 可选`，除名称外都可省：
- 类别：取家长提到的词（如「语文」「校内」→ 校内作业），认不出来默认 `打卡`
- 分数：数字，默认 10
- 「可选」/「不强制」→ `required:false`；默认 `true`

**2. 解析日期（决定哪天做 = start_date）**：
| 说法 | 转换 |
|---|---|
| 今天 / 明天 / 后天 / 大后天 | 今天 +0/+1/+2/+3 |
| `X月X日`、`X/X`、`YYYY-MM-DD` | 取该日期 |
| `周X`（周一到周日） | 最近的一个该星期几 |
| 一句里带多个日期（如「周一语文、周二英语」） | 每天生成一个任务，各自带日期 |

**3. 动作语义**：
| 家长说法 | 操作 |
|---|---|
| 「布置」「加」「安排」「每天做」 | POST 新增 |
| 「把 XX 改成 15 分」「XX 不用做了」「停掉 XX」 | PATCH（改字段 / `active:false` 软删） |
| 「删掉 XX」 | DELETE（找到 title 匹配的任务 id） |
| 「查一下最近的任务」 | GET 查询 |

**4. 完整示例**：

> 家长：「周一到周五，周一语文、周二英语、周三数学、周四阅读、周五跳绳，都是必做，5 分」
>
> agent 动作：
> 1. 计算今天（2026-10-19 是周一），周一=今天 10-19，周二=10-20，周三=10-21，周四=10-22，周五=10-23
> 2. POST 数组，5 条任务，各自 `schedule:once` + 对应 `start_date`/`end_date`
> 3. 提示家长「已布置周一~周五，每天一个任务」，若当天已有同名任务先提醒

**5. 操作前必查**：新增前先 GET 查有没有同名任务已绑定同一天（title + start_date 相同），有则提醒家长或改分数，不要重复建。

---

## 六、注意事项

- **只动 `tasks` 表**。不要增删改 `task_logs` / `pokemon` / `point_logs` / `item_logs`，它们由孩子端/家长端自己维护。
- **删除要谨慎**：删 weekly 父任务先删子任务；普通情况用软删（`active:false`）。
- **积分范围**：1~100，超了会被前端钳制，最好直接给合理值。
- **日期格式**：一律 `YYYY-MM-DD` 字符串。
- **单日专属任务**：`schedule:once` + `start_date`=该天 + `end_date`=同值。错过当天孩子就看不到了（孩子端只显示今天）。
- **改完无需通知前端**：孩子/家长端打开页面会自动拉到最新数据（每次进入都重新查询）。
- 若尚未在 Supabase 执行 `sql/upgrade_v8.sql`（加 `start_date`/`end_date` 列），POST 带日期字段会报错——先在 Supabase SQL Editor 执行一次。
