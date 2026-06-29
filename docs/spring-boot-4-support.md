# Spring Boot 4 Support — Analysis & Plan

**Status:** Draft — **Phase A + B complete.** All SB4 modules (`engine-spring/core-7` + the seven `spring-boot-starter-4` submodules) compile **main + test** under Spring Boot 4 (the `webapps` frontend builds in this env). The test suite was executed: it surfaced one real migration defect (the `spring-boot-jdbc` transaction-manager regression, now fixed); the only remaining failures are an environmental embedded-Tomcat loopback limitation of this sandbox (see §6 “Test execution”). The OIDC roadmap items are next.
**Date:** 26 June 2026
**Branch:** `feature/spring-boot-4-starter`
**Source:** Roadmap e-mail "CadenzaFlow Change Requests in Update Roadmap for V1.3" (Hudai Asmaz), item 1
**Reference:** CIB Seven — https://github.com/cibseven/cibseven/tree/main/spring-boot-4-starter

---

## 1. Goal

Some customers run on **Spring Boot 3**, others want **Spring Boot 4**. We must serve **both** segments. This work is therefore **additive, not a migration**: keep the existing SB3 starter and add a **parallel** SB4 starter, maintained side by side (exactly as CIB Seven does — SB3 `3.5.x` and SB4 `4.0.x` in parallel).

## 2. The request (roadmap e-mail, item 1)

> Duplicate `spring-boot-starter` → `spring-boot-starter-4` (like CIB Seven). Produce the Maven artifacts:
> `cadenzaflow-bpm-springboot-starter-4`, `…-starter-test-4`, `…-starter-rest-4`, `…-starter-webapp-4`.

The e-mail describes this as "just duplicate the starter." The CIB reference shows it is **more than that** (see §4).

## 3. What CIB Seven actually did (reference analysis)

Spring Boot 4 = **Spring Framework 7 + Jakarta EE 11 + Tomcat 11**. CIB built it in layers:

```
engine-spring/core-7   →  artifact: cibseven-engine-spring-7   (Spring 7 engine-spring — the foundation)
        ▲
spring-boot-4-starter  →  parallel to spring-boot-starter; submodule artifacts use the "-4" suffix
        ▲
run4 distribution      →  Spring Boot 4 variant of "run" (SCIM/OIDC; PR #350, Tomcat 11 pin PR #351/#363)
```

Concrete points:
- **`engine-spring/core-7`** — CIB's `engine-spring/` has `core`, `core-6`, **`core-7`**. The SB4 starter `starter` module depends on `cibseven-engine-spring-7`.
- **`spring-boot-4-starter/`** mirrors `spring-boot-starter/` (submodules: `starter`, `starter-rest`, `starter-security`, `starter-test`, `starter-client/spring-boot`, `starter-webapp-core`, `starter-webapp`).
  - Root pom `cibseven-bpm-spring-boot-4-starter-root`, **same parent** as SB3 (`cibseven-database-settings`).
  - Dependency management imports **Spring Boot 4 BOM + Spring Framework 7 BOM + Jakarta EE 11 BOM (`jakarta.jakartaee-bom:11.0.0`)**, plus **HK2 4.0.0** and a **`spring-context` 7.x pin**; embedded **Tomcat 11.x**.
  - Published submodule artifacts use the **`-4` suffix** (e.g. `cibseven-bpm-spring-boot-starter-4`). PR **#342** standardized this suffix.
  - Drops the plain-`spring` client variant (only `spring-boot`).
- **Aggregation** — the top platform pom lists both `spring-boot-starter` and `spring-boot-4-starter` as modules, side by side.

## 4. Gap analysis — e-mail vs. what we actually need

| # | E-mail says | Reality (per CIB reference) |
|---|---|---|
| 1 | (nothing) | **`engine-spring/core-7` first** — Spring 7 engine-spring; the SB4 starter depends on it. We have `core` + `core-6`, **not `core-7`**. |
| 2 | 4 artifacts | ~7 submodules (also `starter-security`, `starter-webapp-core`, `starter-client/spring-boot`). The 4 are a subset. |
| 3 | mixed naming ("springboot"/"spring-boot") | consistent **`-4` suffix**: root `…-spring-boot-4-starter-root`, submodules `…-spring-boot-starter-4`. |
| 4 | (nothing) | new version properties (`version.spring-boot4`, `version.spring.framework7`), Jakarta EE 11 / Tomcat 11 / HK2 / spring-context overrides, and aggregation in the platform pom. |
| 5 | (nothing) | CIB also built a **`run4`** distribution — confirm whether in scope here (relates to e-mail items 2/3 OIDC). |

## 5. Current CadenzaFlow state

- `engine-spring/` → `core`, `core-6` (**no `core-7`**).
- `spring-boot-starter/` → present (SB3), root `cadenzaflow-bpm-spring-boot-starter-root`, parent `cadenzaflow-database-settings` (`../database`, v1.2.0).
- SB3 version: `version.spring-boot = 3.5.14` in `parent/pom.xml:24`.
- Platform pom aggregates `spring-boot-starter` as a `<module>` in 4 profiles (`cadenzaflow-bpm-platform/pom.xml` ~lines 69, 129, 243, 276).
- No pre-existing SB4 branch (verified). Closest existing branch `3722-spring-boot-3.2-support` is SB **3.2**, unrelated.

## 6. Plan (phased)

**Phase A — `engine-spring/core-7` (prerequisite).** Mirror `engine-spring/core-6` to a new `core-7` targeting Spring Framework 7; artifact `cadenzaflow-engine-spring-7`. (Confirm scope with Hudai — see §8.)

**Phase B — `spring-boot-starter-4` module.** Duplicate `spring-boot-starter/`:
- Root pom `cadenzaflow-bpm-spring-boot-4-starter-root`, parent `cadenzaflow-database-settings` (same as SB3).
- Submodule artifacts with `-4` suffix (`cadenzaflow-bpm-spring-boot-starter-4`, `…-starter-test-4`, `…-starter-rest-4`, `…-starter-webapp-4`, + security / webapp-core / client as needed).
- Dependency management: Spring Boot 4 BOM + Spring Framework 7 BOM + Jakarta EE 11 BOM + HK2 4.0.0 + `spring-context` 7.x pin; Tomcat 11.x.
- `starter` depends on `cadenzaflow-engine-spring-7` (Phase A).

**Phase C — wiring.**
- Add `version.spring-boot4` and `version.spring.framework7` properties to `parent/pom.xml` (next to `version.spring-boot`).
- Add `<module>spring-boot-starter-4</module>` next to `spring-boot-starter` in the platform pom (same 4 profiles).

**Phase D — `run4` distribution (only if in scope).** Defer until confirmed (§8).

**Verify.** Build the SB3 starter (unchanged) and the new SB4 starter; smoke-test a minimal SB4 app.

### Progress (this branch)

**Phase A — `engine-spring/core-7` — DONE.** Mirrored `core-6` exactly (it reuses `../core/src` via the Eclipse Transformer; no Java sources of its own). Three changes vs `core-6`:
- `parent/pom.xml` — added `version.spring.framework7 = 7.0.6` and `version.spring-boot4 = 4.0.7` (next to the SB3 properties).
- `engine-spring/core-7/pom.xml` — new module, artifact `cadenzaflow-engine-spring-7`; imports Spring Framework 7 BOM (`${version.spring.framework7}`) + Jakarta EE 11 BOM (`11.0.0`) instead of Spring 6 / EE 10.
- `engine-spring/pom.xml` — registered `core-7` in the `jdk17` profile next to `core-6`.

This matches CIB Seven's `engine-spring/core-7` 1:1 (same dependency set, same build plugins).

**Verified:** `mvn -pl engine-spring/core-7 -am install` → `CadenzaFlow Platform - engine - Spring 7 ... SUCCESS`; artifact `cadenzaflow-engine-spring-7:1.2.0` installed. The transformed `core` sources compile against Spring 7 + Jakarta EE 11 with no source changes.

**Phase B — `spring-boot-starter-4` — IN PROGRESS.** Duplicated `spring-boot-starter` → `spring-boot-starter-4` (dropped `starter-qa` and the plain-`spring` client variant, matching CIB). Wiring:
- Submodule artifactIds → `-4` suffix; root `cadenzaflow-bpm-spring-boot-4-starter-root`; the `starter` dependency `cadenzaflow-engine-spring-6` → `cadenzaflow-engine-spring-7`.
- Root pom dependency management → Spring Boot 4 + Spring Framework 7 + Jakarta EE 11 BOMs + HK2 4.0.0 + spring-context 7.x pin; spring-boot-maven-plugin → SB4.
- `bom/cadenzaflow-only-bom` → added `cadenzaflow-engine-spring-7` version management.
- Registered `spring-boot-starter-4` in the platform pom (4 profiles).

SB4 source migration so far (mirroring CIB, in `starter` + `starter-test`): JUnit 4 (`junit:junit` compile); actuator health package (`o.s.b.actuate.health` → `o.s.b.health.contributor`); `HibernateJpaAutoConfiguration` (class-ref → string-name); `TestRestTemplate` (→ `o.s.b.resttestclient`) + `spring-boot-resttestclient` test dep.

Plus `starter-rest`: Jersey autoconfigure moves (`o.s.b.autoconfigure.jersey.*` and `…autoconfigure.web.servlet.JerseyApplicationPath` → `o.s.b.jersey.autoconfigure.*`).

**Verified:** the **non-webapp main artifacts build under Spring Boot 4** — `starter`, `starter-test`, `starter-rest`, `starter-client/spring-boot` all SUCCESS, JARs installed (`mvn -pl <those> -Dmaven.test.skip=true install`, reusing the already-installed `engine-spring-7` + upstream; no `-am`). `engine-spring-7` itself builds and installs from Phase A.

**OpenRewrite note.** The `rewrite-maven-plugin` (`UpgradeSpringBoot_4_0`, as CIB uses) is configured in the SB4 root pom for the bulk migration, but a clean run needs the **full reactor**: in a partial `-pl` reactor it failed — the `run` goal forks compilation (sources don't compile yet), and `runNoFork` cannot resolve unbuilt sibling modules (e.g. `…-webapp-4`). The per-module source migration above was therefore done **manually, mirroring CIB**; OpenRewrite stays available for a future full-reactor run.

**Webapps + webapp modules — DONE.** The `webapps` frontend builds in this environment (~2.6 min, then cached). `starter-webapp-core` / `starter-webapp` compile under SB4 after: the `jdbc` autoconfigure rename (`o.s.b.autoconfigure.jdbc.*` → `o.s.b.jdbc.autoconfigure.*`), `SecurityProperties` → `SecurityFilterProperties` (`o.s.b.security.autoconfigure.web.servlet`), `TestRestTemplate` → resttestclient; plus **test deps** `spring-boot-jdbc` + `spring-boot-security` (SB4 split-out autoconfigure modules) and `spring-boot-resttestclient`. `LocalServerPort` stays unchanged (`o.s.b.test.web.server`).

**`starter-security` — DONE.** Mechanical renames (`SecurityProperties` → `SecurityFilterProperties`, `@MockBean` → `@MockitoBean`, `AutoConfigureMockMvc` → `o.s.b.webmvc.test.autoconfigure`, jdbc / oauth2 autoconfigure splits) **plus a small reimplementation**: SB4 made Spring's `ClientsConfiguredCondition` package-private, so `impl/ClientsConfiguredCondition` and `impl/ClientsNotConfiguredCondition` were reimplemented as public `SpringBootCondition`s that bind `spring.security.oauth2.client.registration` (mirroring CIB). Test deps added: `spring-boot-resttestclient`, `spring-boot-webmvc-test`.

**All seven `spring-boot-starter-4` submodules now compile main + test under Spring Boot 4** — verified: `mvn -pl <all 7> -DskipTests install` → `BUILD SUCCESS` (13 s; `engine-spring-7` + webapps reused from earlier installs).

### Test execution (run on this branch)

The test suite was then executed (not just compiled). Results:

| Module | Result |
|---|---|
| `starter-test` | ✅ pass |
| `starter` | ✅ **182** tests pass |
| `starter-rest` | ✅ pass |
| `starter-client/spring-boot` | ✅ **8** tests pass |
| `starter-webapp-core` | 🟡 29/33 — 4 fail (environmental, see below) |
| `starter-webapp` | 🟡 `WebappTest` 2 fail (same environmental cause) |
| `starter-security` | ✅ compiles; its `*IT` tests run only under the `integration-test-cadenzaflow-run` profile (not the default build), so none ran here — no failures |

**One real migration defect was found by running the tests, and fixed** (commit *"add spring-boot-jdbc to core starter…"*): Spring Boot 4 split `DataSourceTransactionManagerAutoConfiguration` out of `spring-boot-autoconfigure` into `spring-boot-jdbc`. The core starter only pulled the JDBC auto-config via `spring-boot-starter-data-jpa`, which is `<optional>true</optional>` and so does **not** flow to downstream modules — the engine then failed to start (`No qualifying bean of type 'PlatformTransactionManager'`). This is a **runtime** regression, not only a test artifact. Fix: a non-optional `spring-boot-jdbc` dependency on the core starter (minimal footprint, no JPA/Hibernate), inherited transitively. After the fix the `PlatformTransactionManager` error is gone and `starter` still passes all 182 tests.

**The remaining 6 failures are a single environmental issue, not migration defects.** Every one is `@SpringBootTest(webEnvironment=RANDOM_PORT)` failing to start embedded Tomcat with `IOException: Unable to establish loopback connection → SocketException: Invalid argument: connect` — i.e. this sandbox cannot open a loopback socket. Proof it is environmental: in the same module `CamundaBpmWebappAutoConfigurationIntegrationTest` (which also boots a web server, but not on a random bound port) passes, and the failure is identical across modules. These will pass on a normal machine / CI.

**Next steps (not done here):**
- Re-run the full SB4 suite on CI / a normal host to clear the 6 environmental Tomcat-loopback failures.
- Optionally run OpenRewrite on the full reactor as a cross-check, and exercise the security `*IT` tests under the `integration-test-cadenzaflow-run` profile.
- The roadmap OIDC items (`webapps-oidc`, `engine-rest` OIDC) are separate.

## 7. POM wiring summary

| Concern | Binding |
|---|---|
| Parent (inheritance) | `cadenzaflow-database-settings` (`../database`, v1.2.0) — same as SB3 |
| Aggregation (reactor) | `cadenzaflow-bpm-platform/pom.xml` → `<module>spring-boot-starter-4</module>` in the 4 profiles that list `spring-boot-starter` |
| Version properties | `parent/pom.xml` — add `version.spring-boot4`, `version.spring.framework7` |
| Naming | root `…-spring-boot-4-starter-root`; submodules `…-spring-boot-starter-4` (suffix) |
| Engine dependency | `cadenzaflow-engine-spring-7` (new `engine-spring/core-7`) |

## 8. Decisions & open items

**Decided (2026-06-26):**
1. **`engine-spring/core-7` — in scope (mandatory prerequisite).** The SB4 starter cannot build without a Spring 7 engine-spring; proceed even though the e-mail omits it.
2. **Artifact set — the full functional set**, not just the 4 named in the e-mail: `starter`, `starter-rest`, `starter-security`, `starter-test`, `starter-webapp-core`, `starter-webapp`, `starter-client/spring-boot`. Drop the plain-`spring` client variant (CIB did too). The 4 names in the e-mail are the headline published artifacts.
3. **Release / branch — part of the 1.3.0 release.** Work on `feature/spring-boot-4-starter`; it lands in the 1.3.0 line, then merges to `master` and is tagged `1.3.0`.

**Open (confirm with Hudai):**
- **`run4` distribution** — deferred; not part of this branch. Likely a separate task tied to the roadmap OIDC items (2 / 3). Confirm scope/sequencing.

## 9. References

- Roadmap e-mail, item 1 (Hudai Asmaz).
- CIB Seven: `spring-boot-4-starter/` and `engine-spring/core-7/`; PRs #342 (artifactId `-4` suffix), #350 (`run4` SCIM), #351 / #363 (Tomcat 11 pin), #365 (parallel SB3/SB4 version bumps).
- CadenzaFlow: `engine-spring/` (`core`, `core-6`), `spring-boot-starter/`, `parent/pom.xml:24` (`version.spring-boot=3.5.14`), `cadenzaflow-bpm-platform/pom.xml` (module aggregation).
