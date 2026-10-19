#!/usr/bin/env python3
# ============================================================
# Kimi 任务岛 - 一键启动本地服务器
# 用法：start.bat(Windows 双击) / bash start.sh(Mac/Linux)
# 或直接 python serve.py
# ============================================================
import http.server
import socket
import os
import webbrowser
import threading

PORT = 8000
os.chdir(os.path.dirname(os.path.abspath(__file__)))


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
print('  🏝️  Kimi 任务岛 · 本地服务器')
print('=' * 46)
print(f'  电脑访问 : http://localhost:{PORT}')
print(f'  手机访问 : http://{ip}:{PORT}   (手机和电脑连同一个 WiFi)')
print('  本地验证 : 手机/电脑浏览器打开上面的地址即可，改完代码刷新即可')
print('-' * 46)
print('  按 Ctrl+C 停止服务器')
print('=' * 46)

server = http.server.ThreadingHTTPServer(('0.0.0.0', PORT), http.server.SimpleHTTPRequestHandler)
threading.Timer(1.0, lambda: webbrowser.open(f'http://localhost:{PORT}')).start()
server.serve_forever()
