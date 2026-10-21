@echo off
chcp 65001 >nul
title 佑佑 任务岛 - 本地服务器
cd /d "%~dp0"
python serve.py
pause
