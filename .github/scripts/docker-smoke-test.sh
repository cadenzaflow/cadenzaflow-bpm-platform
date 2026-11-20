#!/usr/bin/env bash
# Starts a container of a CadenzaFlow image and checks that it is the release it says it is:
# the engine answers, it reports the version, the webapps are served.
#
# Usage: docker-smoke-test.sh <image> <version>
# Prints the Java of the image; in a workflow also as the step output "java".
set -euo pipefail

image=$1
version=$2
name="cadenzaflow-smoke-$$"
port=${SMOKE_PORT:-18080}
base="http://127.0.0.1:$port"

logs() {
  echo "--- last lines of the container log ---"
  docker logs --tail 80 "$name" 2>&1 || true
}
fail() {
  echo "::error::$1"
  logs
  exit 1
}
trap 'docker rm -f "$name" >/dev/null 2>&1 || true' EXIT

# reachable from this machine only
docker run -d --name "$name" -p "127.0.0.1:$port:8080" "$image" >/dev/null

echo "Waiting for the engine of $image ..."
attempt=0
until curl -fsS "$base/engine-rest/engine" >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$(docker inspect -f '{{.State.Running}}' "$name")" != "true" ]; then
    fail "The container stopped"
  fi
  if [ "$attempt" -ge 60 ]; then
    fail "The engine did not answer within 5 minutes"
  fi
  sleep 5
done

reported=$(curl -fsS "$base/engine-rest/version")
case "$reported" in
  *"\"$version\""*) echo "Version: $reported" ;;
  *) fail "The engine reports $reported, expected $version" ;;
esac

curl -fsS "$base/cadenzaflow/app/welcome/default/" >/dev/null || fail "The webapps are not served"
echo "Webapps: served"

java=$(docker exec "$name" sh -c 'echo "$JAVA_VERSION"')
[ -n "$java" ] || fail "The image does not tell its Java (JAVA_VERSION)"
echo "Java: $java"
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "java=$java" >> "$GITHUB_OUTPUT"
fi
