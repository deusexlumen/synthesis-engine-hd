#!/bin/sh
# Container entrypoint: apply pending Prisma migrations, then start the API.
#
# Fails closed on purpose. If "migrate deploy" fails the container exits and
# the platform reports a failed deploy, instead of booting an API against an
# unmigrated schema where every request 500s.
#
# Migrations run over DIRECT_URL (schema.prisma: datasource.directUrl), which
# must be a session-mode connection. Prisma migrations need advisory locks and
# prepared statements, which Supabase's transaction pooler (port 6543) does not
# support.
#
# Single-instance assumption: this runs on every container start, so two
# instances booting at once race for the migration advisory lock. Prisma's lock
# makes the loser wait rather than corrupt anything, but before scaling past
# one instance move this to a platform pre-deploy hook (Render:
# preDeployCommand, available on paid instance types).
set -e

echo "[entrypoint] applying database migrations..."
npx prisma migrate deploy

echo "[entrypoint] migrations applied, starting API..."
exec node dist/index.js
