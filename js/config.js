// ============================================================
// Kimi 任务岛 - 游戏数值配置
// 所有规则数值都在这里，想改规则只动这个文件即可
// ============================================================

const CONFIG = {
  // ---------- 数据模式 ----------
  // 'demo'    = 本地试玩模式：数据存浏览器 localStorage，不连数据库，无需填 key，先看效果
  // 'supabase'= 真实模式：连接 Supabase 数据库（部署到远程前改这里并填写下方 key）
  DB_MODE: 'demo',

  // ---------- Supabase 数据库（DB_MODE='supabase' 时必须填写！） ----------
  SUPABASE_URL: 'https://ipitcujpkfszghngfzwp.supabase.co',   // 你的 Project URL（不带 /rest/v1/）
  SUPABASE_ANON_KEY: '在这里粘贴你的anon_public_key',          // Settings → API Keys → anon / publishable

  // ---------- 家长模式 ----------
  PARENT_PASSWORD: '2024',        // 家长密码（个人使用，简单即可）

  // ---------- 任务类别（自定义，家长端下拉+可输入新值，孩子端按此顺序分区展示） ----------
  // 顺序即孩子端展示顺序：校内在前，孩子会先做完校内再做校外
  DEFAULT_CATEGORIES: ['校内作业', '校外作业', '作业', '打卡', '阅读', '运动', '家务', '英语', '数学', '音乐', '练字', '编程'],

  // 类别图标：按关键词匹配（命中即用该图标）
  CATEGORY_EMOJI_RULES: [
    { match: '校内', emoji: '🏫' },
    { match: '校外', emoji: '🏠' },
    { match: '作业', emoji: '📖' },
    { match: '阅读', emoji: '📚' },
    { match: '运动', emoji: '🏃' },
    { match: '跳', emoji: '🏃' },
    { match: '家务', emoji: '🧹' },
    { match: '整理', emoji: '🧹' },
    { match: '背', emoji: '🗣️' },
    { match: '写', emoji: '✏️' },
    { match: '画', emoji: '🎨' },
    { match: '音乐', emoji: '🎵' },
    { match: '练字', emoji: '🖊️' },
    { match: '实验', emoji: '🔬' },
    { match: '编程', emoji: '💻' },
    { match: '英语', emoji: '🇬🇧' },
    { match: '数学', emoji: '🧮' },
  ],
  // 图标兜底池：新类别按名称哈希稳定分配一个
  CATEGORY_EMOJI_POOL: ['🎯', '🌟', '🎈', '⚽', '🎨', '🎼', '🧩', '🚲', '🪁', '🎲', '📝', '🎤', '⏰', '🌱', '🫧'],

  // ---------- 进度型长期任务 ----------
  PROGRESS_STEPS: [30, 60, 100],   // 单次打卡可选完成百分比按钮

  // ---------- 积分 ----------
  REQUIRED_DONE_BONUS: 5,         // 每日必选任务全部完成的额外奖励积分
  OPTIONAL_DONE_BONUS: 3,         // 每日可选任务全部完成的额外奖励积分
  MAX_POINTS_PER_TASK: 100,       // 单个任务积分上限（防手滑）

  // ---------- 连续全勤 ----------
  STREAK_DAYS_FOR_BALL: 7,        // 连续全勤多少天送精灵球
  STREAK_REWARD_BALLS: 1,         // 一次送几个精灵球

  // ---------- 精灵球 / 捕捉 ----------
  BALL_PRICE: 100,                // 积分买一个精灵球的价格
  // 捕捉必出新：每次一定是没抓过的宝可梦，绝不重复
  // 闪光个体：不由捕捉产出，而是连续全勤时随机点亮一只已有的
  RARE_PROBABILITY: 0.15,         // 普通球抽到稀有宝可梦的概率

  // ---------- 升级 / 进化 ----------
  POINTS_TO_EXP: 1,               // 1 积分 = 1 exp（喂宝可梦）
  EXP_PER_LEVEL: 100,             // 每 100 exp 升 1 级
  EVOLVE_EXP: [100, 300, 600],    // 各段进化需要的经验：经验满一管就能进化，
                                  // 越后面的进化需要的经验越多（对应进化链第 1、2 个箭头）
                                  // 进化会消耗这管经验
  LEVEL_CAP: 100,                 // 等级上限

  // ---------- 稀有度权重（捕捉随机池） ----------
  // common 常见 / rare 稀有。基础形态才能被捕捉，进化形态靠喂养解锁
  RARITY: {
    common: 0.85,
    rare: 0.15,
  },
};
