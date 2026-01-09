#!/usr/bin/env bash
set -e

python manage.py migrate --noinput

if [ "${SEED_CIQUEST:-0}" != "0" ]; then
  python manage.py seed_ciquest
fi

gunicorn ciquest_server.wsgi:application --bind 0.0.0.0:$PORT
