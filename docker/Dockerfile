# CadenzaFlow Platform on Apache Tomcat.
#
# Build context: this directory, with the archive of the release next to this file as
#   cadenzaflow-bpm-tomcat.tar.gz
# .github/workflows/docker-images.yml takes it from the GitHub Release, builds the image and tests it.
#
# The Java of the image is the base image below. It is pinned to an exact version and digest, so the
# Java of a published image is known, and a new Java release arrives as a pull request (Dependabot).
FROM eclipse-temurin:17.0.21.1_2-jre-alpine@sha256:2b4113ae80e31f103b284dd3bc3e008add670cf8555417b5b289fa1128f2f0a3

RUN apk add --no-cache curl tar gzip bash tzdata tini xmlstarlet

# The version of the release in the image
ARG CADENZAFLOW_VERSION

# Settings of the container; the values here are the defaults
ENV CADENZAFLOW_VERSION=${CADENZAFLOW_VERSION}
ENV DB_DRIVER=
ENV DB_URL=
ENV DB_USERNAME=
ENV DB_PASSWORD=
ENV DB_CONN_MAXACTIVE=20
ENV DB_CONN_MINIDLE=5
ENV DB_CONN_MAXIDLE=20
ENV DB_VALIDATE_ON_BORROW=false
ENV DB_VALIDATION_QUERY="SELECT 1"
ENV SKIP_DB_CONFIG=
ENV WAIT_FOR=
ENV WAIT_FOR_TIMEOUT=30
ENV TZ=UTC
ENV DEBUG=false
ENV JAVA_OPTS=""
ENV JMX_PROMETHEUS=false
ENV JMX_PROMETHEUS_CONF=/cadenzaflow/javaagent/prometheus-jmx.yml
ENV JMX_PROMETHEUS_PORT=9404

# The server does not run as root
RUN addgroup -g 1000 -S cadenzaflow && \
    adduser -u 1000 -S cadenzaflow -G cadenzaflow -h /cadenzaflow -s /bin/bash -D cadenzaflow

# The Tomcat of the archive (server/apache-tomcat-<version>/) becomes /cadenzaflow.
# The archive is mounted for this step only, so it does not stay in a layer of the image; the
# files get their owner in the same step, so they are in the image once.
RUN --mount=type=bind,source=cadenzaflow-bpm-tomcat.tar.gz,target=/tmp/cadenzaflow-bpm-tomcat.tar.gz \
    mkdir -p /cadenzaflow/javaagent \
    && tar -xzf /tmp/cadenzaflow-bpm-tomcat.tar.gz -C /cadenzaflow --strip-components=2 \
    && chown -R cadenzaflow:cadenzaflow /cadenzaflow

# The PostgreSQL JDBC driver, for a database other than the built-in H2
ADD --chown=cadenzaflow:cadenzaflow https://jdbc.postgresql.org/download/postgresql-42.7.3.jar /cadenzaflow/lib/postgresql-42.7.3.jar

WORKDIR /cadenzaflow

# The start script and the configuration it fills in from the settings above
COPY --chown=cadenzaflow:cadenzaflow --chmod=755 cadenzaflow-lib.sh /cadenzaflow/
COPY --chown=cadenzaflow:cadenzaflow --chmod=755 cadenzaflow-tomcat.sh /cadenzaflow/cadenzaflow.sh
COPY --chown=cadenzaflow:cadenzaflow prometheus-jmx.yml /cadenzaflow/javaagent/prometheus-jmx.yml
COPY --chown=cadenzaflow:cadenzaflow server.xml /cadenzaflow/conf/server.xml
COPY --chown=cadenzaflow:cadenzaflow bpm-platform.xml /cadenzaflow/conf/bpm-platform.xml

USER cadenzaflow

EXPOSE 8080 9404

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["./cadenzaflow.sh"]
