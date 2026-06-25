#!/usr/bin/env sh
# Entrypoint for the Purnazen backend container.
#
# Applies DB migrations (idempotent) then starts the API. With more than one
# replica, run migrations as a one-off instead and set RUN_MIGRATIONS=0 to
# avoid concurrent `alembic upgrade` races (see docs/DEPLOYMENT.md).
set -eu

PORT="${PORT:-5000}"
WORKERS="${WEB_CONCURRENCY:-2}"

if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  echo "[entrypoint] applying alembic migrations..."
  alembic upgrade head
fi

echo "[entrypoint] starting gunicorn on :${PORT} with ${WORKERS} worker(s)"
exec gunicorn app.main:app \
  --worker-class uvicorn.workers.UvicornWorker \
  --workers "${WORKERS}" \
  --bind "0.0.0.0:${PORT}" \
  --timeout 120 \
  --access-logfile - \
  --error-logfile -
