// ============================================================
// 宝可梦数据表 - 初代 151 只
// no: 图鉴编号(即图片文件名)  name: 中文名
// e: 进化为哪只(编号)  rarity: 稀有度 common常见/rare稀有
// 捕捉池 = 所有"没有进化前体"的宝可梦（运行时自动计算）
// ============================================================

const POKEMON = [
  // --- 御三家草系 ---
  { no: 1,  name: '妙蛙种子', e: 2,   rarity: 'rare' },
  { no: 2,  name: '妙蛙草',   e: 3 },
  { no: 3,  name: '妙蛙花' },
  // --- 御三家火系 ---
  { no: 4,  name: '小火龙',   e: 5,   rarity: 'rare' },
  { no: 5,  name: '火恐龙',   e: 6 },
  { no: 6,  name: '喷火龙',   rarity: 'rare' },
  // --- 御三家水系 ---
  { no: 7,  name: '杰尼龟',   e: 8,   rarity: 'rare' },
  { no: 8,  name: '卡咪龟',   e: 9 },
  { no: 9,  name: '水箭龟',   rarity: 'rare' },
  // --- 虫系 ---
  { no: 10, name: '绿毛虫',   e: 11 },
  { no: 11, name: '铁甲蛹',   e: 12 },
  { no: 12, name: '巴大蝶' },
  { no: 13, name: '独角虫',   e: 14 },
  { no: 14, name: '铁壳蛹',   e: 15 },
  { no: 15, name: '大针蜂' },
  // --- 鸟系 ---
  { no: 16, name: '波波',     e: 17 },
  { no: 17, name: '比比鸟',   e: 18 },
  { no: 18, name: '大比鸟' },
  { no: 19, name: '小拉达',   e: 20 },
  { no: 20, name: '拉达' },
  { no: 21, name: '烈雀',     e: 22 },
  { no: 22, name: '大嘴雀' },
  { no: 23, name: '阿柏蛇',   e: 24 },
  { no: 24, name: '阿柏怪' },
  // --- 电系明星 ---
  { no: 25, name: '皮卡丘',   e: 26,  rarity: 'rare' },
  { no: 26, name: '雷丘',     rarity: 'rare' },
  // --- 地面系 ---
  { no: 27, name: '穿山鼠',   e: 28 },
  { no: 28, name: '穿山王' },
  // --- 毒系双线 ---
  { no: 29, name: '尼多兰',   e: 30 },
  { no: 30, name: '尼多娜',   e: 31 },
  { no: 31, name: '尼多后',   rarity: 'rare' },
  { no: 32, name: '尼多朗',   e: 33 },
  { no: 33, name: '尼多力诺', e: 34 },
  { no: 34, name: '尼多王',   rarity: 'rare' },
  // --- 超能系 ---
  { no: 35, name: '皮皮',     e: 36 },
  { no: 36, name: '皮可西' },
  { no: 63, name: '凯西',     e: 64 },
  { no: 64, name: '勇吉拉',   e: 65 },
  { no: 65, name: '胡地',     rarity: 'rare' },
  { no: 96, name: '催眠貘',   e: 97 },
  { no: 97, name: '引梦貘人' },
  { no: 122, name: '魔墙人偶' },
  // --- 火系 ---
  { no: 37, name: '六尾',     e: 38 },
  { no: 38, name: '九尾' },
  { no: 58, name: '卡蒂狗',   e: 59 },
  { no: 59, name: '风速狗',   rarity: 'rare' },
  { no: 77, name: '小火马',   e: 78 },
  { no: 78, name: '烈焰马' },
  { no: 126, name: '鸭嘴火兽', rarity: 'rare' },
  // --- 一般系 ---
  { no: 39, name: '胖丁',     e: 40 },
  { no: 40, name: '胖可丁' },
  { no: 52, name: '喵喵',     e: 53 },
  { no: 53, name: '猫老大' },
  { no: 56, name: '猴怪',     e: 57 },
  { no: 57, name: '火爆猴' },
  { no: 83, name: '大葱鸭' },
  { no: 84, name: '嘟嘟',     e: 85 },
  { no: 85, name: '嘟嘟利' },
  { no: 108, name: '大舌头' },
  { no: 113, name: '吉利蛋',  rarity: 'rare' },
  { no: 115, name: '袋兽' },
  { no: 128, name: '肯泰罗' },
  { no: 132, name: '百变怪' },
  { no: 143, name: '卡比兽',  rarity: 'rare' },
  // --- 飞行/虫过渡 ---
  { no: 41, name: '超音蝠',   e: 42 },
  { no: 42, name: '大嘴蝠' },
  { no: 46, name: '派拉斯',   e: 47 },
  { no: 47, name: '派拉斯特' },
  { no: 48, name: '毛球',     e: 49 },
  { no: 49, name: '摩鲁蛾' },
  { no: 123, name: '飞天螳螂', rarity: 'rare' },
  { no: 127, name: '凯罗斯' },
  // --- 草/毒 ---
  { no: 43, name: '走路草',   e: 44 },
  { no: 44, name: '臭臭花',   e: 45 },
  { no: 45, name: '霸王花' },
  { no: 69, name: '喇叭芽',   e: 70 },
  { no: 70, name: '口呆花',   e: 71 },
  { no: 71, name: '大食花' },
  { no: 114, name: '蔓藤怪' },
  // --- 水/地面 ---
  { no: 50, name: '地鼠',     e: 51 },
  { no: 51, name: '三地鼠' },
  { no: 54, name: '可达鸭',   e: 55 },
  { no: 55, name: '哥达鸭' },
  // --- 水系 ---
  { no: 60, name: '蚊香蝌蚪', e: 61 },
  { no: 61, name: '蚊香君',   e: 62 },
  { no: 62, name: '蚊香泳士' },
  { no: 72, name: '玛瑙水母', e: 73 },
  { no: 73, name: '毒刺水母' },
  { no: 79, name: '呆呆兽',   e: 80 },
  { no: 80, name: '呆壳兽' },
  { no: 86, name: '小海狮',   e: 87 },
  { no: 87, name: '白海狮' },
  { no: 90, name: '大舌贝',   e: 91 },
  { no: 91, name: '刺甲贝' },
  { no: 98, name: '大钳蟹',   e: 99 },
  { no: 99, name: '巨钳蟹' },
  { no: 116, name: '墨海马',  e: 117 },
  { no: 117, name: '海刺龙' },
  { no: 118, name: '角金鱼',  e: 119 },
  { no: 119, name: '金鱼王' },
  { no: 120, name: '海星星',  e: 121 },
  { no: 121, name: '宝石海星' },
  { no: 129, name: '鲤鱼王',  e: 130 },
  { no: 130, name: '暴鲤龙',  rarity: 'rare' },
  { no: 131, name: '拉普拉斯', rarity: 'rare' },
  // --- 岩石/电 ---
  { no: 74, name: '小拳石',   e: 75 },
  { no: 75, name: '隆隆石',   e: 76 },
  { no: 76, name: '隆隆岩' },
  { no: 95, name: '大岩蛇' },
  { no: 81, name: '小磁怪',   e: 82 },
  { no: 82, name: '三合一磁怪' },
  { no: 100, name: '雷电球',  e: 101 },
  { no: 101, name: '顽皮雷弹' },
  { no: 111, name: '铁甲犀牛', e: 112 },
  { no: 112, name: '铁甲暴龙' },
  { no: 138, name: '菊石兽',  e: 139 },
  { no: 139, name: '多刺菊石兽' },
  { no: 140, name: '化石盔',  e: 141 },
  { no: 141, name: '镰刀盔' },
  { no: 142, name: '化石翼龙', rarity: 'rare' },
  // --- 幽灵/毒 ---
  { no: 88, name: '臭泥',     e: 89 },
  { no: 89, name: '臭臭泥' },
  { no: 92, name: '鬼斯',     e: 93 },
  { no: 93, name: '鬼斯通',   e: 94 },
  { no: 94, name: '耿鬼',     rarity: 'rare' },
  { no: 109, name: '瓦斯弹',  e: 110 },
  { no: 110, name: '双弹瓦斯' },
  // --- 格斗 ---
  { no: 66, name: '腕力',     e: 67 },
  { no: 67, name: '豪力',     e: 68 },
  { no: 68, name: '怪力' },
  { no: 104, name: '卡拉卡拉', e: 105 },
  { no: 105, name: '嘎啦嘎啦' },
  { no: 106, name: '飞腿郎' },
  { no: 107, name: '快拳郎' },
  // --- 伊布家族（分支进化简化为独立捕捉） ---
  { no: 133, name: '伊布',    rarity: 'rare' },
  { no: 134, name: '水伊布',  rarity: 'rare' },
  { no: 135, name: '雷伊布',  rarity: 'rare' },
  { no: 136, name: '火伊布',  rarity: 'rare' },
  // --- 其他 ---
  { no: 137, name: '多边兽' },
  { no: 124, name: '迷唇姐',  rarity: 'rare' },
  { no: 125, name: '电击兽',  rarity: 'rare' },
  { no: 102, name: '蛋蛋',    e: 103 },
  { no: 103, name: '椰蛋树' },
  // --- 传说 ---
  { no: 144, name: '急冻鸟',  rarity: 'rare' },
  { no: 145, name: '闪电鸟',  rarity: 'rare' },
  { no: 146, name: '火焰鸟',  rarity: 'rare' },
  { no: 147, name: '迷你龙',  e: 148 },
  { no: 148, name: '哈克龙',  e: 149 },
  { no: 149, name: '快龙',    rarity: 'rare' },
  { no: 150, name: '超梦',    rarity: 'rare' },
  { no: 151, name: '梦幻',    rarity: 'rare' },
];

// ---------- 运行时索引（勿改） ----------
const PK_BY_NO = {};
POKEMON.forEach(p => { PK_BY_NO[p.no] = p; });

// 谁是我的进化前体（被指向的编号）
const PK_EVOLVE_FROM = {};
POKEMON.forEach(p => { if (p.e) PK_EVOLVE_FROM[p.e] = p.no; });

// 捕捉池：没有进化前体的才能被精灵球捕捉
const CATCH_POOL = {
  common: POKEMON.filter(p => !PK_EVOLVE_FROM[p.no] && p.rarity !== 'rare').map(p => p.no),
  rare:   POKEMON.filter(p => !PK_EVOLVE_FROM[p.no] && p.rarity === 'rare').map(p => p.no),
};

// 精灵图路径
function spritePath(no, shiny) {
  return `assets/sprites/${shiny ? 'shiny' : 'normal'}/${no}.gif`;
}

// 沿进化链计算某只是第几形态（0=基础 1=一段 2=二段）
function evoStage(no) {
  let stage = 0, cur = no;
  while (PK_EVOLVE_FROM[cur] !== undefined) { cur = PK_EVOLVE_FROM[cur]; stage++; }
  return stage;
}
