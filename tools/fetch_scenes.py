#!/usr/bin/env python3
# ============================================================
# 抓取「宝可梦卡牌151」系列的中文卡图，压缩后写入 assets/scenes/{图鉴编号}.jpg
#
# 来源：神奇宝贝百科 https://wiki.52poke.com （文件 151C001.png … 151C192.png）
# 用法：python3 tools/fetch_scenes.py            # 下载 1–151（对应图鉴编号）
#       python3 tools/fetch_scenes.py --from 1 --to 151 --workers 6
#
# 说明：
# - 仅家庭自用；卡图版权归 Pokémon / Nintendo / Creatures / GAME FREAK 所有，别公开分发。
# - 需要 PIL（Pillow）。图片会压到 400×600 以内的 JPEG（约 50–70KB），151 张约 8–10MB。
# - 已存在且能正常打开的输出会跳过（可断点续传）。
# ============================================================
import argparse
import io
import json
import os
import subprocess
import sys
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    from PIL import Image
except ImportError:
    sys.exit('需要 Pillow：pip install pillow')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, 'assets', 'scenes')
API = 'https://wiki.52poke.com/api.php'
REF = 'https://wiki.52poke.com/'
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/120 Safari/537.36')
MAX_W, MAX_H = 400, 600
QUALITY = 82


def curl_get(url, timeout=60):
    """用 curl 取内容（--noproxy 绕开本机公司代理；HTTP/2 比 Python 内置客户端稳）。
    --speed-time/--speed-limit：连接卡住（速度过低持续 25 秒）就主动放弃重试，别干等超时。"""
    r = subprocess.run(
        ['curl', '-sSL', '--fail', '-m', str(timeout), '--noproxy', '*',
         '--speed-time', '25', '--speed-limit', '512',
         '-A', UA, '-e', REF, url],
        capture_output=True)
    if r.returncode != 0 or not r.stdout:
        raise RuntimeError(f'curl 失败({r.returncode}) {r.stderr[:120].decode("utf-8", "ignore")}')
    return r.stdout


def api(params):
    url = API + '?' + urllib.parse.urlencode(params)
    return json.loads(curl_get(url, timeout=45).decode('utf-8'))


def file_title(no):
    return f'151C{no:03d}.png'


def fetch_urls(numbers):
    """一次拿全部直链（allimages 支持按前缀列出并直接返回 URL），比逐批 titles 查询稳得多"""
    want = set(numbers)
    for attempt in range(5):
        try:
            d = api({'action': 'query', 'list': 'allimages', 'aiprefix': '151C',
                     'aiprop': 'url|size', 'ailimit': '500', 'format': 'json'})
            out = {}
            for it in d.get('query', {}).get('allimages', []):
                name = it.get('name', '')
                try:
                    n = int(name.split('151C')[1].split('.')[0])
                except Exception:
                    continue
                if n in want and it.get('url'):
                    out[n] = it['url']
            return out
        except Exception as e:
            if attempt == 4:
                print(f'  ! 查询直链失败：{e}')
            time.sleep(3 + attempt * 3)
    return {}


def out_path(no):
    return os.path.join(OUT_DIR, f'{no}.jpg')


def valid(path):
    try:
        with Image.open(path) as im:
            im.load()
        return True
    except Exception:
        return False


def save_card(raw, no):
    """校验 + 缩放 + 存 JPEG（先写 .part，成功再改名，避免留下坏图）"""
    with Image.open(io.BytesIO(raw)) as im:
        im.load()
        im = im.convert('RGB')
        im.thumbnail((MAX_W, MAX_H), Image.LANCZOS)
        tmp = out_path(no) + '.part'
        im.save(tmp, 'JPEG', quality=QUALITY, optimize=True)
        os.replace(tmp, out_path(no))
    return os.path.getsize(out_path(no))


def download(n, url, retries=4):
    for attempt in range(retries):
        try:
            raw = curl_get(url, timeout=120)
            if len(raw) < 5000:
                raise ValueError(f'文件过小（{len(raw)}B）')
            size = save_card(raw, n)
            return n, size, None
        except Exception as e:
            if attempt == retries - 1:
                return n, 0, str(e)
            time.sleep(3 + attempt * 3)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--from', dest='start', type=int, default=1)
    ap.add_argument('--to', dest='end', type=int, default=151)
    ap.add_argument('--workers', type=int, default=6)
    ap.add_argument('--urls-file', help='直链缓存 JSON（{编号: url}）；wiki API 抽风时用它跳过查询')
    args = ap.parse_args()
    os.makedirs(OUT_DIR, exist_ok=True)

    nums = list(range(args.start, args.end + 1))
    todo = [n for n in nums if not (os.path.exists(out_path(n)) and valid(out_path(n)))]
    print(f'目标 {len(nums)} 张，已有 {len(nums) - len(todo)} 张，待下载 {len(todo)} 张')
    if not todo:
        print('全部已就绪')
        return 0

    if args.urls_file:
        print('读取直链缓存…')
        raw = json.load(open(args.urls_file, encoding='utf-8'))
        urls = {int(k): v for k, v in raw.items() if int(k) in set(todo) and v}
    else:
        print('查询直链…')
        urls = fetch_urls(todo)
    missing = [n for n in todo if n not in urls]
    if missing:
        print(f'  ! 查不到直链：{missing[:10]}{" …" if len(missing) > 10 else ""}')

    done = 0
    failed = []
    total_bytes = 0
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        futs = {pool.submit(download, n, urls[n]): n for n in todo if n in urls}
        for fut in as_completed(futs):
            n, size, err = fut.result()
            done += 1
            if err:
                failed.append((n, err))
                print(f'  ✗ #{n:03d} {err}  [{done}/{len(futs)}]')
            else:
                total_bytes += size
                print(f'  ✓ #{n:03d} {size/1024:.0f}KB  [{done}/{len(futs)}]')
    print(f'\n完成：{done - len(failed)} 张成功，{len(failed)} 张失败，'
          f'新增 {total_bytes/1024/1024:.1f}MB')
    if failed:
        print('失败列表：', ', '.join(str(n) for n, _ in failed))
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
