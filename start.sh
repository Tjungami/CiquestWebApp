#!/usr/bin/env bash
set -e

# --------------------------------------------
# One-time recovery for broken django_migrations
# (When tables exist but django_migrations was truncated)
# --------------------------------------------

# 1) Fix contenttypes first (the root cause of "column name does not exist")
python manage.py migrate contenttypes 0001 --fake-initial
python manage.py migrate contenttypes 0002 --fake

# 2) Fake-initial other Django built-in apps
python manage.py migrate auth --fake-initial
python manage.py migrate admin --fake-initial
python manage.py migrate sessions --fake-initial

# 3) Fake-initial your app migrations (tables already exist)
python manage.py migrate ciquest_model --fake-initial

# 4) Finally, apply any remaining migrations normally
python manage.py migrate --noinput

# --------------------------------------------
# Optional seeds (controlled by env vars)
# --------------------------------------------
if [ "${SEED_CIQUEST:-0}" != "0" ]; then
  python manage.py seed_ciquest
fi

if [ "${SEED_TEST_OWNER:-0}" != "0" ]; then
  python manage.py create_test_owner \
    --email "${TEST_OWNER_EMAIL:-owner@example.com}" \
    --password "${TEST_OWNER_PASSWORD:-testpassword}" \
    --name "${TEST_OWNER_NAME:-Test Owner}"
fi

if [ "${SEED_SUPERUSER:-0}" != "0" ]; then
  python manage.py create_demo_superuser \
    --username "${SUPERUSER_USERNAME:-admin}" \
    --email "${SUPERUSER_EMAIL:-admin@example.com}" \
    --password "${SUPERUSER_PASSWORD:-password}"
fi

# Start app
gunicorn ciquest_server.wsgi:application --bind 0.0.0.0:$PORT
