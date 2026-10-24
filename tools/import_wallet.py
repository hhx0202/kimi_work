# -*- coding: utf-8 -*-
"""
把佑佑的 xlsx 账单导入 Supabase 的 wallet_logs 表。
前提：sql/upgrade_v9.sql 已在 Supabase SQL Editor 里执行过（表已存在）。
用法：python tools/import_wallet.py
幂等：表里已有数据时拒绝导入（除非加 --force）。
"""
import io
import json
import re
import sys
import datetime
import zipfile
import urllib.request
from xml.etree import ElementTree as ET

XLSX = r'D:/AI/kimi_work/_preview/wallet_src.xlsx'
URL = 'https://ipitcujpkfszghngfzwp.supabase.co/rest/v1/wallet_logs'
KEY = 'sb_publishable_nB4k3A_lo1VmYzZxUMGOcg_krEckErZ'
FILL_DATE = '2024-11-02'   # 表里两笔没写日期的，按相邻行补

OUT_RULES = [
    ('罚款', ['罚款', '早饭发脾气']),
    ('零食', ['零食', '奥利奥', '小馒头', '咖啡', 'rio', '薯片', '糖', '冰棍', '冰淇淋', '饮料']),
    ('文具', ['文具', '笔袋', '数学用具', '笔记本', '尺子', '橡皮', '书', '寻宝记']),
    ('礼物', ['礼物', '冰箱贴', '送妈', '送爸爸', '发圈', '挂件', '鲜花', '请爸妈', '种球']),
    ('衣服', ['校裤', '衣服', '鞋', '裤']),
    ('娱乐', ['打枪', '电玩', '抓娃娃', '游戏币', '娃娃机', '电影', '游乐']),
    ('玩具', ['玩具', '高达', '哪吒', '玩偶', '火箭', '宝可梦', '卡包', '积木', '弓箭', '卡片', '牌', '乌龟']),
]
IN_RULES = [('阅读排名', ['周排名']), ('奖励', ['晨读', '打卡', '星星', '手表心'])]


def classify(note, d):
    s = str(note or '')
    for cat, keys in (OUT_RULES if d == 'out' else IN_RULES):
        if any(k in s for k in keys):
            return cat
    return '其他' if d == 'out' else '零花钱'


def parse():
    NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
    z = zipfile.ZipFile(XLSX)
    shared = [''.join(t.text or '' for t in si.iter(NS + 't'))
              for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall(NS + 'si')]
    st = ET.fromstring(z.read('xl/styles.xml'))
    fmts = {nf.get('numFmtId'): (nf.get('formatCode') or '') for nf in st.iter(NS + 'numFmt')}
    date_styles = set()
    for i, xf in enumerate(st.find(NS + 'cellXfs').findall(NS + 'xf')):
        fid = xf.get('numFmtId')
        if fid in {'14', '15', '16', '17', '22', '45', '46', '47'} or re.search(r'[ymd]', fmts.get(fid, '') or '', re.I):
            date_styles.add(str(i))

    def cidx(ref):
        L = re.match(r'([A-Z]+)', ref).group(1)
        return sum((ord(c) - 64) * (26 ** i) for i, c in enumerate(reversed(L))) - 1

    rows = []
    for row in ET.fromstring(z.read('xl/worksheets/sheet1.xml')).iter(NS + 'row'):
        cells = {}
        for c in row.findall(NS + 'c'):
            v = c.find(NS + 'v')
            if v is None:
                continue
            t, s, raw = c.get('t'), c.get('s'), v.text
            if t == 's':
                val = shared[int(raw)]
            elif t == 'str':
                val = raw
            else:
                n = float(raw)
                val = (datetime.date(1899, 12, 30) + datetime.timedelta(days=int(n))).isoformat() \
                    if (s is not None and str(s) in date_styles and n > 30000) else n
            cells[cidx(c.get('r'))] = val
        if cells:
            rows.append((int(row.get('r')), [cells.get(i, '') for i in range(max(cells) + 1)]))

    recs = []
    for rn, r in rows:
        if rn <= 2:
            continue
        if isinstance(r[0], float) and r[0]:   # A列金额 = 收入
            note = str(r[2] if len(r) > 2 else '')
            recs.append({'log_date': str(r[1] or FILL_DATE), 'dir': 'in', 'cat': classify(note, 'in'),
                         'note': note, 'amt': round(r[0], 2), 'pending': False})
        if len(r) > 3 and isinstance(r[3], float) and r[3]:   # D列金额 = 支出
            note = str(r[5] if len(r) > 5 else '')
            recs.append({'log_date': str(r[4] if len(r) > 4 else '') or FILL_DATE, 'dir': 'out', 'cat': classify(note, 'out'),
                         'note': note, 'amt': round(r[3], 2), 'pending': False})
    recs.sort(key=lambda x: (x['log_date'], 0 if x['dir'] == 'in' else 1))
    return recs


def req(method, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(URL, data=data, method=method, headers={
        'apikey': KEY, 'Authorization': 'Bearer ' + KEY,
        'Content-Type': 'application/json', 'Prefer': 'return=representation',
    })
    with urllib.request.urlopen(r) as resp:
        return json.loads(resp.read().decode() or 'null')


def main():
    force = '--force' in sys.argv
    recs = parse()
    tin = sum(r['amt'] for r in recs if r['dir'] == 'in')
    tout = sum(r['amt'] for r in recs if r['dir'] == 'out')
    print(f'解析 {len(recs)} 笔：收入 {tin:.2f} / 支出 {tout:.2f} / 余额 {tin - tout:.2f}')

    try:
        existing = [] if force else req('GET')
    except Exception:
        print('wallet_logs 表还不存在——请先在 Supabase SQL Editor 里执行 sql/upgrade_v9.sql，再跑本脚本')
        sys.exit(1)
    if existing:
        print(f'表里已有 {len(existing)} 条，拒绝导入（加 --force 可覆盖导入）')
        return
    for i in range(0, len(recs), 50):
        req('POST', recs[i:i + 50])
        print(f'  已导入 {min(i + 50, len(recs))}/{len(recs)}')
    rows = req('GET')
    gin = sum(r['amt'] for r in rows if r['dir'] == 'in')
    gout = sum(r['amt'] for r in rows if r['dir'] == 'out')
    print(f'导入完成：库里 {len(rows)} 笔，收入 {gin:.2f} / 支出 {gout:.2f} / 余额 {gin - gout:.2f}')
    ok = abs(gin - tin) < 0.01 and abs(gout - tout) < 0.01
    print('校验' + ('通过 ✅' if ok else '不一致 ❌'))
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
