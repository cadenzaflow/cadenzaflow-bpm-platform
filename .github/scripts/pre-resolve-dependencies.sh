#!/usr/bin/env bash
#
# Puts the dependencies of the whole reactor into the local Maven repository,
# so that Trivy finds them there and never asks remote repositories (Maven
# Central rate-limits this runner, and Trivy then exits before writing a
# report).
#
# dependency:resolve builds nothing: a module that depends on another module
# of the reactor gets that artifact from the repositories, where it exists only
# if a release published it at the reactor version. Modules added since the
# last release (such as Run 4 or the Tomcat 11 distribution) therefore cannot
# resolve their sibling modules. That is expected and does not fail this step;
# any other artifact that does not resolve - or any other error - still does.
#
# Usage: .github/scripts/pre-resolve-dependencies.sh   (from the repository root)

set -uo pipefail

# the runner empties RUNNER_TEMP after every job
log="${RUNNER_TEMP:-/tmp}/pre-resolve-dependencies.log"

version="$(./mvnw -q -N help:evaluate -Dexpression=project.version -DforceStdout)"
echo "Reactor version: ${version}"

if ./mvnw -B -DskipTests --fail-at-end dependency:resolve > "$log" 2>&1; then
  echo "All dependencies resolved."
  exit 0
fi

failures="$(grep -E '^\[ERROR\] Failed to execute goal' "$log" || true)"
if [ -z "$failures" ]; then
  tail -n 60 "$log"
  echo "::error::dependency:resolve failed without a module failure to check (see above)."
  exit 1
fi

unexpected=0
while IFS= read -r line; do
  if [[ "$line" != *"Could not resolve dependencies for project "* ]]; then
    echo "$line"
    unexpected=1
    continue
  fi
  project="$(sed -E 's/.*Could not resolve dependencies for project ([^ ]+): .*/\1/' <<< "$line")"
  # every Maven coordinate (group:artifact:type[:classifier]:version) the line names
  coordinates="$(grep -oE '[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+(:[A-Za-z0-9_.-]+)?:[0-9][A-Za-z0-9_.-]*' <<< "$line" | sort -u)"
  for coordinate in $coordinates; do
    [ "$coordinate" = "$project" ] && continue
    if [[ "$coordinate" == org.cadenzaflow.*:"$version" ]]; then
      echo "Not released yet (built by this reactor): ${coordinate}"
    else
      echo "::error::Unresolved dependency of ${project}: ${coordinate}"
      unexpected=1
    fi
  done
done <<< "$failures"

if [ "$unexpected" -ne 0 ]; then
  echo "::error::dependency:resolve failed for more than unreleased reactor artifacts."
  exit 1
fi
echo "::warning::Some reactor modules depend on modules not released at ${version}; everything else is resolved."
