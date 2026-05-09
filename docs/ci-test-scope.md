# CI test scope — `cadenzaflow-bpm-platform`

Bu doküman push-trigger CI'da hangi testlerin koştuğunu, hangilerinin neden bilinçli olarak dışarıda bırakıldığını anlatır.

## Tetikleyiciler

| Workflow | Tetikleyici | Kapsam |
|---|---|---|
| `.github/workflows/test.yml` | push to `master` + `cadenzaflow-*.*.*` + PR + manuel | Hızlı geri bildirim — engine + engine-rest + core webapps + DMN/CMMN/Spring/CDI/Quarkus + ensure-clean-db-plugin |
| (TODO) nightly | scheduled | Container integration (Tomcat/WildFly), DB matrix (PostgreSQL/MySQL/Oracle/DB2/SQLServer), large-data, performance |

## Push-trigger scope

```bash
./mvnw clean install --batch-mode --fail-at-end --threads 1C -P-distro -DskipITs
```

`-P-distro` flag'i hem **root pom**'daki hem **`qa/pom.xml`**'deki `distro` profile'ini deaktive eder. `qa/` altında **sadece `ensure-clean-db-plugin`** profil-dışı kaldığı için aktif olarak çalışır; gerisi (aşağıdaki tablo) kapatılır.

## Push-trigger'da koşmayan modüller ve nedenler

| Modül | Sebep | Ne zaman koşar |
|---|---|---|
| `qa/integration-tests-engine` | Arquillian in-container, WildFly/Tomcat install gerektirir; pom-level `<skipTests>true</skipTests>` zaten var | Nightly + manuel `-Pengine-integration` profili ile |
| `qa/integration-tests-engine-jakarta` | Aynı; Jakarta EE varyantı | Aynı |
| `qa/integration-tests-webapps` | Selenium + chromedriver + container; `-Pwebapps-integration` profili | Nightly |
| `qa/test-db-instance-migration` | Camunda 7.x → newer engine upgrade scenario'ları. Şubat 2026 rebrand'inde 341 test sınıfı silindi (`c0181472ff`, `ce089e3621`); kalan parent skeleton CadenzaFlow track'i için anlamsız. | Drop adayı — şu an skip |
| `qa/test-db-rolling-update` | Eski engine versiyonu ile rolling update test'i; CadenzaFlow versionlama Camunda upgrade path'i takip etmiyor | Drop adayı — şu an skip |
| `qa/test-old-engine` | Eski engine (Camunda 7.x) ile uyumluluk kanıtı; CadenzaFlow başlangıç sürümü 1.0+ | Drop adayı — şu an skip |
| `qa/large-data-tests` | Yüksek bellek/zaman; data-volume regresyon | Nightly + manuel |
| `qa/performance-tests-engine` | Throughput/latency ölçüm; CI'da gürültülü | Manuel + ayrı performance pipeline |
| `qa/tomcat-runtime`, `qa/tomcat9-runtime` | Tomcat binary download + paketleme; integration profil bağımlısı | Integration profili çalıştığında |
| `qa/wildfly-runtime`, `qa/wildfly26-runtime` | WildFly binary download + paketleme; aynı | Aynı |

## Push-trigger'da koşan modüller (özet)

- `engine` (~9.000 test) — process engine core, Mybatis, history, authorization, batch, migration, identity, vb.
- `engine-rest/engine-rest` (~7.000 test) — REST endpoint'leri, **Optimize endpoint'leri dahil** (mock-bazlı, ortam gerektirmez)
- `engine-rest/engine-rest-jakarta` — Jakarta EE varyantı
- `engine-cdi`, `engine-spring`, `engine-spring-6` — entegrasyonlar
- `engine-plugins/*` — connect, identity-ldap, spin-plugin, vb.
- `engine-dmn/*` — DMN engine + FEEL
- `engine-cmmn/*` — CMMN engine
- `model-api/*` — BPMN/CMMN/DMN/XML model API
- `webapps/assembly` (~5.000 test) — Cockpit/Tasklist/Admin backend test'leri
- `quarkus-extension/*` — Quarkus engine extension
- `distro/run` — Run CE bootstrapping
- `distro/license-book` — license SBOM
- `qa/ensure-clean-db-plugin` — DB hijyen plugin'i

## Database scope

Push-trigger CI **H2 in-memory** kullanır (default). PostgreSQL / MySQL / Oracle / DB2 / SQLServer / Aurora matrix'i nightly job'a ayrılacak (TODO):

`.ci/config/matrices.yaml` Camunda Inc'ten miras kalan eski Jenkins matrisi — kullanılmıyor, eninde sonunda silinmeli veya yeni format'a port edilmeli.

## Bilinen sorun: port 8085 hardcode

`webapp-jakarta` modülünde 6 security filter test sınıfı (CsrfPreventionCookieTest, SessionCookieTest, XssProtectionTest, StrictTransportSecurityTest, ContentSecurityPolicyTest, ContentTypeOptionsTest) `HeaderRule.startServer` ile **port 8085**'e bind eder. Paralel CI koşumlarında veya runner'da port çakışması halinde ~50 test environment-error verir. Fix: `ServerSocket(0)` ile dinamik port. İzleme: `feedback_cadenzaflow_webapp_port_8085.md`.

İlk CI koşumunda bu hata gelirse `-fae` (fail-at-end) sayesinde diğer testler tamamlanır ve Surefire artifact'inde patern net görünür.

## Drop edilmesi tartışılan modüller

`qa/test-db-instance-migration`, `qa/test-db-rolling-update`, `qa/test-old-engine` modülleri Camunda upgrade test infrastructure'ından miras. Şubat 2026 rebrand'inde test'lerin önemli bir kısmı silinmişti; kalan iskelet CadenzaFlow için işlevsel değil. Tamamen silmek (commit + dependencies) ayrı bir takip işi.

## Camunda 8 / Zeebe / Optimize / camunda-cloud kalıntısı

Kod tarafında **yok** (`grep -rli "zeebe\|operate\|camunda-cloud\|camunda-8\|connector-runtime"` boş döner). Optimize endpoint'i farklı: Camunda Optimize ürününün engine-rest tarafından beslediği endpoint, **Camunda 7'de de vardı**, mock-bazlı unit test'leri push'ta çalışır.
