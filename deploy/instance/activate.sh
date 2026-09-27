#!/usr/bin/env bash
# Activates a release on the web server. Run as root (by SSM Run Command from the deploy
# workflow) from inside the extracted bundle:  ./activate.sh <stage> <prisma-version>
#
# 1. Writes the runtime config from SSM Parameter Store (/lwk/<stage>/web/*).
# 2. Applies database migrations with the RDS-managed secret.
# 3. Points /opt/lwk/current at this release and restarts the service.
# 4. Checks /api/v1/health and rolls back to the previous release if it fails.
set -euo pipefail

stage=${1:?usage: activate.sh <stage> <prisma-version>}
prisma_version=${2:?usage: activate.sh <stage> <prisma-version>}
release=$(cd "$(dirname "$0")" && pwd)
export AWS_REGION=af-south-1
export PATH=/opt/node/bin:$PATH

echo "Activating $release for stage $stage"

# 1. Runtime config. Parameter names are the environment variable names; none are secrets.
env_file=$(mktemp)
prefix="/lwk/$stage/web/"
aws ssm get-parameters-by-path --path "$prefix" --query 'Parameters[].[Name,Value]' \
  --output text | while IFS=$'\t' read -r name value; do
  printf '%s=%s\n' "${name#"$prefix"}" "$value"
done >"$env_file"
cat >>"$env_file" <<EOF
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0
AWS_REGION=$AWS_REGION
PGSSLROOTCERT=/etc/lwk/rds-ca.pem
EOF
install -m 0640 -o root -g lwk "$env_file" /etc/lwk/web.env
rm -f "$env_file"

# 2. Migrations. The password is read from Secrets Manager into this process only.
if [ "$(prisma --version 2>/dev/null | awk '/^prisma /{print $3}')" != "$prisma_version" ]; then
  npm install --global --no-fund --no-audit "prisma@$prisma_version"
fi
(
  set -a
  # shellcheck disable=SC1091
  . /etc/lwk/web.env
  set +a
  password=$(aws secretsmanager get-secret-value --secret-id "$DATABASE_SECRET_ARN" \
    --query SecretString --output text |
    node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(encodeURIComponent(JSON.parse(s).password)))')
  export DATABASE_URL="postgresql://$DATABASE_USER:$password@$DATABASE_HOST:${DATABASE_PORT:-5432}/$DATABASE_NAME?sslmode=require&sslaccept=strict"
  unset password
  # Prisma's migration engine reads only the first certificate of an `sslcert` file; the RDS
  # bundle holds several roots, so trust the whole bundle through OpenSSL instead.
  export SSL_CERT_FILE="$PGSSLROOTCERT"
  cd "$release/migrate"
  prisma migrate deploy
)

# 3. Switch and restart. The app itself is read-only; only the Next.js cache is writable.
previous=""
if [ -L /opt/lwk/current ] && [ -d "$(readlink -f /opt/lwk/current)/app" ]; then
  previous=$(readlink -f /opt/lwk/current)
fi
chmod -R u=rwX,go=rX "$release"
mkdir -p "$release/app/apps/web/.next/cache"
chown -R lwk:lwk "$release/app/apps/web/.next/cache"
ln -sfn "$release" /opt/lwk/current
systemctl restart lwk-web

# 4. Health check, with rollback.
healthy=false
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3000/api/v1/health >/dev/null; then
    healthy=true
    break
  fi
  sleep 2
done

if [ "$healthy" != true ]; then
  echo "Health check failed. Recent logs:"
  systemctl status lwk-web --no-pager -l | head -12 || true
  tail -n 60 /var/log/lwk/web.log || true
  if [ -n "$previous" ] && [ "$previous" != "$release" ]; then
    echo "Rolling back to $previous"
    ln -sfn "$previous" /opt/lwk/current
    systemctl restart lwk-web
  fi
  exit 1
fi

# Keep the three most recent releases.
ls -1dt /opt/lwk/releases/*/ 2>/dev/null | tail -n +4 | xargs -r rm -rf
echo "Release is live: $release"
