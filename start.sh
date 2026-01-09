#!/usr/bin/env bash
set -e

# 0) Repair broken migration history (one-time recovery)
python manage.py migrate --noinput --fake-initial
python manage.py migrate contenttypes 0002 --fake

# 1) Apply remaining migrations normally
python manage.py migrate --noinput

# 2) Seed base data (optional)
if [ "${SEED_CIQUEST:-0}" != "0" ]; then
  python manage.py seed_ciquest
fi

# Optional: seed a test owner when SEED_TEST_OWNER is set (idempotent)
if [ "${SEED_TEST_OWNER:-0}" != "0" ]; then
  python manage.py create_test_owner \
    --email "${TEST_OWNER_EMAIL:-owner@example.com}" \
    --password "${TEST_OWNER_PASSWORD:-testpassword}" \
    --name "${TEST_OWNER_NAME:-Test Owner}"
fi

# Optional: seed a superuser when SEED_SUPERUSER is set (idempotent)
if [ "${SEED_SUPERUSER:-0}" != "0" ]; then
  python manage.py create_demo_superuser \
    --username "${SUPERUSER_USERNAME:-admin}" \
    --email "${SUPERUSER_EMAIL:-admin@example.com}" \
    --password "${SUPERUSER_PASSWORD:-password}"
fi

# Start app
gunicorn ciquest_server.wsgi:application --bind 0.0.0.0:$PORT
