#!/bin/sh
# Project-only local runtime: never inherit production database, storage or email.
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
mkdir -p .local/tmp
export DJANGO_DEBUG=1
export DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
export DJANGO_CSRF_TRUSTED_ORIGINS=http://127.0.0.1:8017,http://localhost:8017,http://127.0.0.1:3007,http://localhost:3007
# Retained synthetic checkout is available only when deliberately opted into.
export HOY_NOCHEVA_LOCAL="${HOY_NOCHEVA_LOCAL:-0}"
# Machine-specific paths (e.g. HOY_NOCHEVA_CREDENTIAL_FILE) belong in the ignored .local/env.sh.
if [ -f .local/env.sh ]; then . ./.local/env.sh; fi
export HOY_NOCHEVA_CREDENTIAL_FILE="${HOY_NOCHEVA_CREDENTIAL_FILE:-}"
export HOY_NOCHEVA_STAFF_FILE="$PWD/.local/nocheva-staff.json"
export DATABASE_URL="sqlite:///$PWD/db.sqlite3"
export DJANGO_EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
export HOY_TEAM_EMAIL=team@houseofyoung.example
export DEFAULT_FROM_EMAIL=hello@houseofyoung.example
export TMPDIR="$PWD/.local/tmp"
unset DJANGO_SECRET_KEY AWS_STORAGE_BUCKET_NAME AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY
unset AWS_S3_ENDPOINT_URL AWS_S3_CUSTOM_DOMAIN DJANGO_MEDIA_URL RAILWAY_PUBLIC_DOMAIN
unset EMAIL_HOST EMAIL_HOST_USER EMAIL_HOST_PASSWORD
if [ "$#" -eq 0 ]; then
    set -- runserver 127.0.0.1:8017 --noreload
fi
exec .venv/bin/python manage.py "$@"
