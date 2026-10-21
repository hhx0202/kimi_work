#!/usr/bin/env bash
# 佑佑 任务岛 - 一键启动本地服务器（Mac / Linux）
# 用法：bash start.sh  或  chmod +x start.sh && ./start.sh
cd "$(dirname "$0")"
python3 serve.py
