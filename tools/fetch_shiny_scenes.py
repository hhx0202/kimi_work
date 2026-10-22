#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
为「闪耀形态」抓第二套场景卡：从 pokemontcg.io 的全卡库里，给初代 151 只各选一张最华丽的卡。

选卡优先级（越靠前越华丽）：
  1. 全图异画  Special Illustration Rare > Illustration Rare > Trainer Gallery
                > Rare Ultra > Ultra Secret > VMAX > VSTAR > V > EX > GX > LV.X
                > Double Rare > Prime > Star > BREAK > Prism Star
  2. 现代普通卡  2023 年之后的 Common / Uncommon / Rare / Rare Holo（有场景、画风新）
  3. 现代任意卡  上面都没有时的兜底
  4. 全卡池      最后的兜底（保证 151 只全覆盖）

排除：
  - sv3pt5（Scarlet & Violet 151，与第一套「收集啦151」同图）
  - me55c / cel25c / cel25（1996 老卡复刻，水彩画风，用户明确不要）

用法：
  python tools/fetch_shiny_scenes.py            # 抓全部
  python tools/fetch_shiny_scenes.py --dry-run  # 只打印选卡结果，不下载
  python tools/fetch_shiny_scenes.py --force    # 忽略已有文件，全部重下
"""
import json
import os
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from collections import defaultdict

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT_DIR = os.path.join(ROOT, 'assets', 'scenes-shiny')
CACHE = os.path.join(tempfile.gettempdir(), 'km_tcg_cache')
MANIFEST = os.path.join(ROOT, 'tools', 'shiny-scene-manifest.json')

W, H = 400, 559                      # 与第一套场景卡完全一致
CDN = 'https://cdn.jsdelivr.net/gh/PokemonTCG/pokemon-tcg-data@master'
BAN_SETS = {'me55c', 'cel25c', 'cel25'}      # 1996 老卡复刻，水彩画风
MODERN = ('sv', 'me', 'swsh')
# sv3pt5 是「151」英文版：它的 001–151 普卡与第一套（简中收集啦151）同图，必须排除；
# 但它的 Illustration Rare / Special Illustration Rare 是整幅异画，第一套没有用过，可以用。
SV151 = 'sv3pt5'
SV151_ALLOW = {'Illustration Rare', 'Special Illustration Rare'}


def banned(rarity, sid):
    if sid in BAN_SETS:
        return True
    if sid == SV151 and rarity not in SV151_ALLOW:
        return True
    return False

# 全图异画（整幅插画 / 没有常规卡框），分值越高越优先
FULL_ART = {
    'Special Illustration Rare': 100,
    'Illustration Rare': 95,
    'Trainer Gallery Rare Holo': 90,
    'Rare Ultra': 85,
    'Ultra Rare': 85,
    'Rare Holo VMAX': 80,
    'Rare Holo VSTAR': 78,
    'Rare Holo V': 75,
    'Rare Holo EX': 70,
    'Rare Holo GX': 70,
    'Rare Holo LV.X': 65,
    'Double Rare': 60,
    'Rare Prime': 52,
    'Rare Holo Star': 50,
    'Rare BREAK': 42,
    'Rare Prism Star': 40,
}
PLAIN = ('Common', 'Uncommon', 'Rare', 'Rare Holo')


def fetch(url, dst, timeout=120):
    """下载到 dst，返回是否可用（部分接口会给 0 字节或 HTML）。"""
    if os.path.exists(dst) and os.path.getsize(dst) > 2000:
        return True
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    subprocess.run(['curl', '--noproxy', '*', '-sSL', '--max-time', str(timeout),
                    '-A', 'Mozilla/5.0 Chrome/120', url, '-o', dst],
                   capture_output=True)
    ok = os.path.exists(dst) and os.path.getsize(dst) > 2000
    if not ok and os.path.exists(dst):
        os.remove(dst)
    return ok


def load_json(path, url):
    if not fetch(url, path):
        return None
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return None


def build_pool():
    """返回 (cov, released)。cov: 编号 -> [(rarity, set_id, card_id, large_url)]"""
    os.makedirs(CACHE, exist_ok=True)
    sets = load_json(os.path.join(CACHE, 'sets.json'), f'{CDN}/sets/en.json')
    if not sets:
        sys.exit('拉取系列清单失败（jsdelivr 不可达？）')
    meta = {s['id']: s for s in sets}
    released = {s['id']: (s.get('releaseDate') or '0000/00/00') for s in sets}

    ids = [s['id'] for s in sets if s['id'] not in BAN_SETS]
    print(f'系列数 {len(ids)}，开始拉卡表（有本地缓存就跳过）…')

    def one(sid):
        p = os.path.join(CACHE, f'{sid}.json')
        d = load_json(p, f'{CDN}/cards/en/{sid}.json')
        return sid, d

    cov = defaultdict(list)
    failed = []
    done = 0
    with ThreadPoolExecutor(10) as ex:
        for sid, d in ex.map(one, ids):
            done += 1
            if d is None:
                failed.append(sid)
                continue
            for c in d:
                nos = [n for n in (c.get('nationalPokedexNumbers') or []) if 1 <= n <= 151]
                if not nos:
                    continue
                rar = c.get('rarity') or '-'
                if banned(rar, sid):
                    continue
                url = (c.get('images') or {}).get('large')
                if not url:
                    continue
                for no in nos:
                    cov[no].append((rar, sid, c['id'], url))
    print(f'卡表拉取完成：成功 {done - len(failed)}，失败 {len(failed)}'
          + (f'（{", ".join(failed[:6])}…）' if failed else ''))
    return cov, released, meta


def pick(cov, released, no):
    """给一个编号选卡，返回 (rarity, set_id, card_id, url, tier)"""
    cands = cov.get(no) or []
    if not cands:
        return None

    # 1) 全图异画：同档内取发售日更新的
    full = [c for c in cands if c[0] in FULL_ART]
    if full:
        best = sorted(full, key=lambda c: (-FULL_ART[c[0]], released.get(c[1], '')))[0]
        return (*best, 'full')

    # 2) 现代普通卡：越新越好
    plain = [c for c in cands
             if c[0] in PLAIN and c[1].startswith(MODERN)]
    if plain:
        best = sorted(plain, key=lambda c: released.get(c[1], ''), reverse=True)[0]
        return (*best, 'plain')

    # 3) 现代任意卡
    modern = [c for c in cands if c[1].startswith(MODERN)]
    if modern:
        best = sorted(modern, key=lambda c: (-FULL_ART.get(c[0], 0),
                                             released.get(c[1], '')))[0]
        return (*best, 'modern')

    # 4) 全卡池兜底
    best = sorted(cands, key=lambda c: (released.get(c[1], ''), FULL_ART.get(c[0], 0)),
                  reverse=True)[0]
    return (*best, 'fallback')


def to_card(src, dst):
    """等比缩放到 400x559（原图 733x1024 比例 0.7158，目标 0.7156，几乎无裁切）"""
    im = Image.open(src).convert('RGB')
    w, h = im.size
    tr = W / H
    if w / h > tr:
        nw = int(h * tr)
        im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else:
        nh = int(w / tr)
        im = im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    im.resize((W, H), Image.LANCZOS).save(dst, quality=86, optimize=True)


def main():
    dry = '--dry-run' in sys.argv
    force = '--force' in sys.argv

    cov, released, meta = build_pool()
    print(f'覆盖编号 {len(cov)} / 151')

    plan = {}
    for no in range(1, 152):
        got = pick(cov, released, no)
        if not got:
            print(f'  ! {no:03d} 无候选')
            continue
        rar, sid, cid, url, tier = got
        plan[no] = dict(no=no, rarity=rar, set=sid, card=cid, url=url, tier=tier)

    from collections import Counter
    tier_cnt = Counter(v['tier'] for v in plan.values())
    print('\n档位分布:', dict(tier_cnt))

    if dry:
        for no, v in sorted(plan.items()):
            print(f'  {no:03d} {v["tier"]:8s} {v["rarity"]:26s} {v["card"]}')
        return

    os.makedirs(OUT_DIR, exist_ok=True)
    tmp_dir = os.path.join(CACHE, 'img')

    def work(item):
        no, v = item
        dst = os.path.join(OUT_DIR, f'{no}.jpg')
        if os.path.exists(dst) and not force:
            return no, 'skip'
        raw = os.path.join(tmp_dir, v['card'] + '.png')
        if not fetch(v['url'], raw):
            return no, 'fail'
        try:
            to_card(raw, dst)
            return no, 'ok'
        except Exception as e:
            return no, f'err:{e}'

    stat = Counter()
    fails = []
    todo = sorted(plan.items())
    with ThreadPoolExecutor(6) as ex:
        for no, r in ex.map(work, todo):
            stat[r] += 1
            if r in ('fail',) or r.startswith('err'):
                fails.append(no)
            if stat['ok'] + stat['skip'] + len(fails) == len(todo) or (no % 20 == 0):
                print(f'  进度 {no}/151 …')

    print('\n结果:', dict(stat))
    if fails:
        print('失败编号:', fails)

    # manifest：记录每只用的哪张卡、什么档位，方便以后核对/替换
    with open(MANIFEST, 'w', encoding='utf-8') as f:
        json.dump([plan[k] for k in sorted(plan)], f, ensure_ascii=False, indent=1)
    print(f'manifest -> {MANIFEST}')

    total = sum(os.path.getsize(os.path.join(OUT_DIR, x))
                for x in os.listdir(OUT_DIR) if x.endswith('.jpg'))
    print(f'输出 {len([x for x in os.listdir(OUT_DIR) if x.endswith(".jpg")])} 张，'
          f'合计 {total / 1048576:.1f} MB')


if __name__ == '__main__':
    main()
