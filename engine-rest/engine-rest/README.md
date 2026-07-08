REST API
========

A JAX-RS-based REST API for Camunda Platform.

OIDC Bearer Authentication (Keycloak)
-------------------------------------

Besides HTTP Basic, the REST API can authenticate requests with an OIDC access
token: `Authorization: Bearer <JWT>`. The token is validated **offline** against
the issuer's JWKS (signature, issuer, expiry, audience) — there is no call to
the identity provider per request. How the client obtained the token
(`client_credentials` or `password`) does not matter to the server.

Enable it in `web.xml` by choosing the authentication provider (a ready-made
commented example ships in the Tomcat distribution's `web.xml`):

* `KeycloakBearerTokenAuthenticationProvider` — Bearer only
* `CompositeAuthenticationProvider` — Bearer **and** Basic (migration mode:
  existing Basic clients keep working unchanged)
* `HttpBasicAuthenticationProvider` — Basic only (today's default; nothing
  changes if you configure nothing)

Filter init-params (only the first two are required):

| Parameter | Default | Purpose |
|---|---|---|
| `keycloak.issuer-uri` | — | expected `iss` claim; also derives the JWKS URL (Keycloak convention) |
| `keycloak.audience` | — | expected client id (checked against `aud` or `azp`) |
| `keycloak.audience-mode` | `aud` | `aud` \| `azp` \| `any` — Keycloak service-account tokens usually carry the client id only in `azp`, so use `azp` (or `any`) for `client_credentials` clients |
| `keycloak.jwks-uri` | derived from issuer | set explicitly for non-Keycloak OIDC providers (from the provider's discovery document) |
| `keycloak.username-claim` | `preferred_username` | claim mapped to the engine user id (fallback: `keycloak.username-claim-fallback`, default `sub`) |
| `keycloak.allowed-algorithms` | `RS256` | accepted JWS algorithms, comma-separated |
| `keycloak.clock-skew-seconds` | `60` | `exp`/`nbf` tolerance |
| `keycloak.jwks-cache-ttl-ms` / `keycloak.jwks-cache-refresh-timeout-ms` / `keycloak.jwks-min-interval-ms` | `300000` / `30000` / `30000` | JWKS cache lifetime / refresh-operation wait cap / unknown-`kid` refetch rate limit |

Notes:

* Groups and tenants are **never** read from the token — they resolve through
  the engine's `IdentityService`, so UI and REST authorization always agree.
* Missing or invalid required parameters fail the filter at deployment time
  (`ServletException`), not silently at request time.
* Prefer `grant_type=client_credentials` for machine-to-machine calls;
  `grant_type=password` (ROPC) is accepted but is a legacy convenience —
  OAuth 2.1 removes it.
* Keycloak setup in short: create a **confidential** client (service accounts
  enabled for `client_credentials`; "Direct Access Grants" only if you need
  ROPC) and use the realm URL as `keycloak.issuer-uri`.

An integration test against a real Keycloak exists and runs on demand
(requires Docker):

    mvn -pl engine-rest/engine-rest test -Dtest=KeycloakBearerTokenAuthenticationProviderContainerIT

Running Tests
-------------

The REST API is tested against three JAX-RS runtimes:

* Jersey
* Resteasy
* Wink

In order to run the tests against any of these, execute `mvn clean install -P${runtime}` where `${runtime}` is either `jersey`, `resteasy`, or `wink`. `jersey` is active by default.

Writing Tests
-------------

For a test case that tests the implementation of a JAX-RS resource, do the following:

* Subclass `org.cadenzaflow.bpm.engine.rest.AbstractRestServiceTest`
* Declare an instance of `org.cadenzaflow.bpm.engine.rest.util.container.TestContainerRule` as a JUnit `@ClassRule`
