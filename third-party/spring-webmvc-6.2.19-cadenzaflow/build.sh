#!/usr/bin/env bash
# Builds org.springframework:spring-webmvc:6.2.19-cadenzaflow.1 into target/dist/:
# the official 6.2.19 artifacts from Maven Central with only XsltView replaced by
# the backport in src/main/java (CVE-2026-47884, upstream commit 692dbc9).
#
# Usage: ./build.sh [path-to-mvn]      (default: mvn on PATH)
# Needs: JDK 17 (javac, jar), curl, sha1sum.
set -euo pipefail
cd "$(dirname "$0")"

MVN=${1:-mvn}
BASE=6.2.19
VERSION=6.2.19-cadenzaflow.1
CENTRAL=https://repo1.maven.org/maven2/org/springframework/spring-webmvc/$BASE
CLASS_DIR=org/springframework/web/servlet/view/xslt
OUT=target/dist
WORK=target/work

echo "== 1/6 compile the patched XsltView and run Spring's XsltViewTests + the location tests"
"$MVN" -B -q clean verify

rm -rf "$OUT" "$WORK"
mkdir -p "$OUT" "$WORK/jar" "$WORK/src"

echo "== 2/6 download the official $BASE artifacts and check them against Central's SHA-1"
for f in "spring-webmvc-$BASE.jar" "spring-webmvc-$BASE-sources.jar" "spring-webmvc-$BASE.pom"; do
  curl -fsSL -o "$WORK/$f" "$CENTRAL/$f"
  expected=$(curl -fsSL "$CENTRAL/$f.sha1" | cut -c1-40)
  actual=$(sha1sum "$WORK/$f" | cut -c1-40)
  [ "$expected" = "$actual" ] || { echo "SHA-1 mismatch for $f" >&2; exit 1; }
done

echo "== 3/6 binary jar: replace XsltView.class, mark the version, add the Maven identity"
(cd "$WORK/jar" && jar xf "../spring-webmvc-$BASE.jar")
cp "target/classes/$CLASS_DIR/XsltView.class" "$WORK/jar/$CLASS_DIR/XsltView.class"
sed -i "s/^Implementation-Version: $BASE\r\?$/Implementation-Version: $VERSION/" "$WORK/jar/META-INF/MANIFEST.MF"
grep -q "^Implementation-Version: $VERSION" "$WORK/jar/META-INF/MANIFEST.MF"
# Spring's jars carry no pom.properties. Without it, scanners cannot identify a
# rebuilt jar at all (unknown checksum) and it disappears from the inventory.
mkdir -p "$WORK/jar/META-INF/maven/org.springframework/spring-webmvc"
printf 'groupId=org.springframework\nartifactId=spring-webmvc\nversion=%s\n' "$VERSION" \
  > "$WORK/jar/META-INF/maven/org.springframework/spring-webmvc/pom.properties"
jar cfm "$OUT/spring-webmvc-$VERSION.jar" "$WORK/jar/META-INF/MANIFEST.MF" -C "$WORK/jar" .

echo "== 4/6 sources jar: official sources with the patched XsltView.java"
(cd "$WORK/src" && jar xf "../spring-webmvc-$BASE-sources.jar")
cp "src/main/java/$CLASS_DIR/XsltView.java" "$WORK/src/$CLASS_DIR/XsltView.java"
jar cf "$OUT/spring-webmvc-$VERSION-sources.jar" -C "$WORK/src" .

echo "== 5/6 pom: the official pom, only the project version changes"
sed "0,/^  <version>$BASE<\/version>/s//  <version>$VERSION<\/version>/" \
  "$WORK/spring-webmvc-$BASE.pom" > "$OUT/spring-webmvc-$VERSION.pom"
[ "$(grep -c "<version>$VERSION</version>" "$OUT/spring-webmvc-$VERSION.pom")" = 1 ]
# dependencies keep pointing at the official $BASE modules
grep -q "<version>$BASE</version>" "$OUT/spring-webmvc-$VERSION.pom"

echo "== 6/6 self-check: nothing but XsltView.class, MANIFEST.MF and pom.properties may differ"
mkdir -p "$WORK/a" "$WORK/b"
(cd "$WORK/a" && jar xf "../spring-webmvc-$BASE.jar")
(cd "$WORK/b" && jar xf "../../dist/spring-webmvc-$VERSION.jar")
(cd "$WORK/a" && find . -type f | sort | xargs sha1sum) > "$WORK/a.sum"
(cd "$WORK/b" && find . -type f | sort | xargs sha1sum) > "$WORK/b.sum"
# diff exits 1 when the files differ (they must): don't let pipefail end the script here
changed=$({ diff "$WORK/a.sum" "$WORK/b.sum" || true; } | { grep -E '^[<>]' || true; } | awk '{print $3}' | sort -u)
expected=$(printf '%s\n' "./$CLASS_DIR/XsltView.class" ./META-INF/MANIFEST.MF \
  ./META-INF/maven/org.springframework/spring-webmvc/pom.properties | sort -u)
if [ "$changed" != "$expected" ]; then
  echo "Unexpected differences to the official jar:" >&2; echo "$changed" >&2; exit 1
fi
echo "$changed" | sed 's/^/   changed: /'

(cd "$OUT" && sha1sum ./*)
