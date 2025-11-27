#!/usr/bin/env bash
set -e

# マイグレーション実行（事前に環境変数 DATABASE_URL を設定しておくこと）
python manage.py migrate --noinput

# 本番起動
gunicorn ciquest_server.wsgi:application --bind 0.0.0.0:$PORT
