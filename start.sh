#!/usr/bin/env bash
set -e

# Run migrations (DATABASE_URL must be set)
python manage.py migrate --noinput

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
