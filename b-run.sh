#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
for f in "$ROOT/.env" "$ROOT/.env.local"; do
  if [ -f "$f" ]; then
    set -a
    # shellcheck disable=SC1090
    . "$f"
    set +a
  fi
done
cd "$ROOT/src/backend"
exec ./mvnw -f pom.xml spring-boot:run