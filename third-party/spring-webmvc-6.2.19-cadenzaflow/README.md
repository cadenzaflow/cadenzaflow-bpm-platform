# spring-webmvc 6.2.19-cadenzaflow.1

A patched build of Spring Framework's `spring-webmvc` 6.2.19. It fixes **CVE-2026-47884** for the CadenzaFlow Run distribution, which is built on Spring Boot 3.5 / Spring Framework 6.2.

## Why

- CVE-2026-47884: `XsltView` can be made to load a stylesheet from an arbitrary location (SSRF, RCE).
- Spring Framework 6.2.x left open-source support on 2026-06-30. The fix for 6.2 (6.2.20) is available to Spring Enterprise customers only.
- The open-source fix (7.0.9, upstream commit [`692dbc9`](https://github.com/spring-projects/spring-framework/commit/692dbc9160de3b5de50ccedeee014716d0cedb7b)) changes 8 lines in one file. It applies to the 6.2.19 source unchanged.

CadenzaFlow itself does not use `XsltView`. The patched jar removes the vulnerable code path from what we ship anyway, so the release security gate does not need an exception for Run.

## What is in the artifact

`org.springframework:spring-webmvc:6.2.19-cadenzaflow.1` is the official 6.2.19 jar from Maven Central with exactly three changes:

| Entry | Change |
|---|---|
| `org/springframework/web/servlet/view/xslt/XsltView.class` | compiled from `src/main/java/.../XsltView.java` (upstream 6.2.19 source + `upstream/692dbc9.patch`) |
| `META-INF/MANIFEST.MF` | `Implementation-Version: 6.2.19-cadenzaflow.1` |
| `META-INF/maven/org.springframework/spring-webmvc/pom.properties` | added, so scanners identify the jar as `6.2.19-cadenzaflow.1` |

The POM is the official 6.2.19 POM with only the project version changed. Its dependencies still point at the official 6.2.19 modules. The sources jar is the official one with the patched `XsltView.java`.

It is published to the CadenzaFlow Nexus only, never to Maven Central (`org.springframework` is not our namespace).

## How it is verified

`build.sh` runs on every build:

1. Compiles the patched class (`--release 17 -parameters`, same as Spring) and runs Spring's own `XsltViewTests`, plus `XsltViewStylesheetLocationTests`. The latter checks that URLs, `../`, `WEB-INF`/`META-INF` and encoded variants are rejected, and that normal classpath locations still work.
2. Downloads the official artifacts and checks them against Central's SHA-1 files.
3. Assembles the artifacts and fails if anything other than the three entries above differs from the official jar.

`mvn verify -Punpatched` runs the same tests against the official, unpatched jar. The location tests fail there, which shows they detect the vulnerability.

## Build and publish

```bash
./build.sh            # artifacts in target/dist/
```

Publishing is done by the `Publish spring-webmvc backport` workflow (manual, `workflow_dispatch`).

## Licence

Spring Framework is licensed under the Apache License 2.0. The modified file carries a notice stating the change. The original `LICENSE`/`NOTICE` files inside the jar are kept.
