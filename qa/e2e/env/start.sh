#!/bin/bash
# Unpacks a distribution archive and starts it the way a user does, with the
# start script it ships. Waits until the REST API answers.
#
#   env/start.sh <archive .tar.gz or .zip> [work directory]
#
# The server listens on port 8080. Stop it with env/stop.sh [work directory].
set -euo pipefail

archive=${1:?usage: start.sh <archive> [work directory]}
work=${2:-"$(dirname "$0")/../.work/distribution"}

rm -rf "$work"
mkdir -p "$work"
case "$archive" in
  *.zip) unzip -q "$archive" -d "$work" ;;
  *) tar -xzf "$archive" -C "$work" ;;
esac
cd "$work"

# the start scripts open the welcome page in a browser when they find one
export BROWSER=/bin/true

# Libraries a user adds to the distribution, e.g. the JDBC driver of another
# database (E2E_USERLIB: files, separated by spaces). Run takes its data
# source from SPRING_DATASOURCE_URL, _USERNAME, _PASSWORD and
# _DRIVER_CLASS_NAME in the environment.
for library in ${E2E_USERLIB:-}; do
  if [ -d configuration/userlib ]; then
    cp "$library" configuration/userlib/
  else
    cp "$library" server/apache-tomcat-*/lib/
  fi
done

if [ -f start-cadenzaflow.sh ]; then
  kind=tomcat
  log=$(echo server/apache-tomcat-*/logs)/catalina.out
  sh ./start-cadenzaflow.sh
elif [ -f start.sh ]; then
  kind=run
  log=run-console.log
  # without arguments: REST API, webapps and the example, in the background
  ./start.sh > "$log" 2>&1
else
  echo "no start script in $archive" >&2
  exit 1
fi
echo "$kind" > .kind

url=http://localhost:8080/engine-rest/version
for attempt in $(seq 1 90); do
  if [ "$(curl -s -o /dev/null -w '%{http_code}' "$url" || true)" = "200" ]; then
    echo "started ($kind): $(curl -s "$url")"
    exit 0
  fi
  sleep 2
done

echo "the distribution did not answer at $url; the end of its log:" >&2
tail -n 80 $log >&2 || true
exit 1
