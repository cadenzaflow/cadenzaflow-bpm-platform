#!/bin/bash
# Stops the distribution that env/start.sh started, with the script it ships,
# and reports what it logged as an error while it ran.
#
#   env/stop.sh [work directory]
set -uo pipefail

work=${1:-"$(dirname "$0")/../.work/distribution"}
cd "$work" || exit 0

export BROWSER=/bin/true
if [ -f shutdown-cadenzaflow.sh ]; then
  sh ./shutdown-cadenzaflow.sh || true
elif [ -f shutdown.sh ]; then
  ./shutdown.sh || true
fi

# The tests make one job fail on purpose (its expression names the bean
# e2eBeanThatDoesNotExist); every other error in the log is a finding.
logs=$(ls server/apache-tomcat-*/logs/* logs/* run-console.log 2>/dev/null)
errors=$(grep -hE '(^|[^A-Za-z])(SEVERE|ERROR)([^A-Za-z]|$)' $logs 2>/dev/null | grep -v 'e2eBeanThatDoesNotExist' || true)
if [ -n "$errors" ]; then
  echo "errors in the log of the distribution:"
  echo "$errors" | head -n 40
  exit 1
fi
echo "no unexpected errors in the log of the distribution"
