#!/usr/bin/env python3
# ============================================================
# 佑佑 任务岛 - 一键启动本地服务器
# 用法：start.bat(Windows 双击) / bash start.sh(Mac/Linux)
# 或直接 python serve.py
# ============================================================
import http.server
import socket
import os
import signal
import subprocess
import sys
import time
import webbrowser
import threading

PORT = 8000
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(PROJECT_DIR)


def port_in_use(port):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        # 和真正启动服务器时一致（SO_REUSEADDR + 0.0.0.0）：
        # 这样只剩 TIME_WAIT 的残留连接不算“占用”，只有真有进程在 LISTEN 才算
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.bind(('0.0.0.0', port))
        return False
    except OSError:
        return True
    finally:
        s.close()


def our_server_pids():
    """找出还在跑的本项目 serve.py。
    关终端不一定会杀进程；而且有的环境里 lsof/fuser 看不到 socket 归属，
    所以 Linux 直接扫 /proc（按"命令行含 serve.py + 工作目录是本项目"认人），
    只认自己的进程，绝不误杀别的程序。"""
    pids = set()
    if os.name == 'nt':
        try:
            out = subprocess.run(['netstat', '-ano'], capture_output=True, text=True, errors='ignore').stdout
            cand = set()
            for line in out.splitlines():
                parts = line.split()
                if len(parts) >= 5 and parts[0].upper() == 'TCP' and parts[1].endswith(f':{PORT}') \
                        and parts[-2].upper() == 'LISTENING' and parts[-1].isdigit():
                    cand.add(parts[-1])
            for pid in cand:
                r = subprocess.run(
                    ['powershell', '-NoProfile', '-Command',
                     f"(Get-CimInstance Win32_Process -Filter 'ProcessId={pid}').CommandLine"],
                    capture_output=True, text=True, errors='ignore')
                cmd = (r.stdout or '').lower()
                if 'serve.py' in cmd and 'python' in cmd:
                    pids.add(pid)
        except Exception:
            pass
        return pids

    if os.path.isdir('/proc'):
        me = str(os.getpid())
        for name in os.listdir('/proc'):
            if not name.isdigit() or name == me:
                continue
            try:
                with open(f'/proc/{name}/cmdline', 'rb') as f:
                    cmd = f.read().replace(b'\0', b' ').decode('utf-8', 'ignore').strip()
                if 'serve.py' not in cmd:
                    continue
                parts = cmd.split()
                # 必须以 python 起头（避免把命令行里恰好带 "serve.py" 的 shell/grep 也算进来）
                if not parts or 'python' not in os.path.basename(parts[0]).lower():
                    continue
                try:
                    cwd = os.readlink(f'/proc/{name}/cwd')
                except Exception:
                    cwd = ''
                if cwd:
                    if os.path.abspath(cwd) != PROJECT_DIR:
                        continue
                else:
                    # 有些环境读不到 cwd/exe（容器/沙箱）：只认 start.sh 用的相对路径形式。
                    # 绝对路径指向别的目录就放过，避免误杀别的项目。
                    arg = next((a for a in parts[1:] if a.endswith('serve.py')), '')
                    if os.path.isabs(arg) and os.path.abspath(arg) != os.path.join(PROJECT_DIR, 'serve.py'):
                        continue
                pids.add(name)
            except Exception:
                continue
        return pids

    # macOS（没有 /proc）：只能借助 lsof + ps
    try:
        out = subprocess.run(['lsof', '-ti', f'tcp:{PORT}', '-sTCP:LISTEN'],
                             capture_output=True, text=True, errors='ignore').stdout
        for pid in (p.strip() for p in out.split() if p.strip().isdigit()):
            c = subprocess.run(['ps', '-p', pid, '-o', 'command='],
                               capture_output=True, text=True, errors='ignore').stdout
            if 'serve.py' in c:
                pids.add(pid)
    except Exception:
        pass
    return pids


def free_port(port):
    """启动前自动停掉上次遗留的本地服务器（关终端不一定会杀进程）"""
    if not port_in_use(port):
        return
    pids = our_server_pids()
    if not pids:
        print(f'  ⚠️ 端口 {port} 被占用，但没找到本项目的旧服务器；请手动关闭占用程序后重试。')
        sys.exit(1)
    killed = []
    for pid in sorted(pids, key=int):
        try:
            if os.name == 'nt':
                subprocess.run(['taskkill', '/F', '/PID', pid], capture_output=True)
            else:
                os.kill(int(pid), signal.SIGTERM)
            killed.append(pid)
        except Exception as e:
            print(f'  ⚠️ 停止旧服务器 PID {pid} 失败：{e}')
    if killed:
        print(f'  已自动停掉上次的旧服务器（PID {", ".join(killed)}）')
    for _ in range(25):
        if not port_in_use(port):
            return
        time.sleep(0.2)
    # 有些进程对 SIGTERM 不敏感（或还在收尾）→ 再补一刀
    for pid in killed:
        try:
            if os.name == 'nt':
                subprocess.run(['taskkill', '/F', '/PID', pid], capture_output=True)
            else:
                os.kill(int(pid), signal.SIGKILL)
        except Exception:
            pass
    for _ in range(10):
        if not port_in_use(port):
            return
        time.sleep(0.2)
    print(f'  ⚠️ 端口 {port} 仍被占用，请手动关闭占用程序后重试。')
    sys.exit(1)


def lan_ip():
    """获取本机在局域网里的 IP（手机访问用）"""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        return s.getsockname()[0]
    except Exception:
        return '127.0.0.1'
    finally:
        s.close()


ip = lan_ip()
print('=' * 46)
print('  🏝️  佑佑 任务岛 · 本地服务器')
print('=' * 46)
print(f'  电脑访问 : http://localhost:{PORT}')
print(f'  手机访问 : http://{ip}:{PORT}   (手机和电脑连同一个 WiFi)')
print('  本地验证 : 手机/电脑浏览器打开上面的地址即可，改完代码刷新即可')
print('-' * 46)
print('  按 Ctrl+C 停止服务器')
print('=' * 46)

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    """本地开发：禁用浏览器缓存，改完代码普通刷新就能看到新版本（避免安卓缓存旧 js）"""
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def send_head(self):
        # 连 304 协商也不要：浏览器带着旧的 If-Modified-Since 来时，直接给最新文件
        if 'If-Modified-Since' in self.headers:
            del self.headers['If-Modified-Since']
        return super().send_head()


free_port(PORT)   # 上次的服务器可能还占着端口（关终端不会杀进程）→ 先停掉它
server = http.server.ThreadingHTTPServer(('0.0.0.0', PORT), NoCacheHandler)
threading.Timer(1.0, lambda: webbrowser.open(f'http://localhost:{PORT}')).start()
server.serve_forever()
