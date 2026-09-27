#!/usr/bin/env bash
# Packages a production build of apps/web into a release bundle for the web server.
# Run from the repo root after `npm run build`, on Linux arm64 (same platform as the server).
# Usage: deploy/build-bundle.sh <output.tgz>
set -euo pipefail

out=${1:?usage: build-bundle.sh <output.tgz>}
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

web=apps/web
mkdir -p "$work/app" "$work/migrate"

# Next.js standalone server plus the static files it does not copy itself.
cp -R "$web/.next/standalone/." "$work/app/"
cp -R "$web/.next/static" "$work/app/$web/.next/static"
cp -R "$web/public" "$work/app/$web/public"

# Never ship local environment files.
find "$work/app" -name '.env*' -delete

# Database migrations, applied on the server before the new release starts.
cp "$web/prisma/schema.prisma" "$work/migrate/"
cp -R "$web/prisma/migrations" "$work/migrate/"
cp deploy/instance/prisma.config.mjs "$work/migrate/"

cp deploy/instance/activate.sh "$work/"
chmod +x "$work/activate.sh"

tar -czf "$out" -C "$work" .
echo "Bundle written to $out ($(du -h "$out" | cut -f1))"
