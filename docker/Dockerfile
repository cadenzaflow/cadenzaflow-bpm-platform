FROM eclipse-temurin:17-jre-alpine

# Gerekli araçları yükle
RUN apk add --no-cache curl tar gzip bash tzdata tini xmlstarlet

# Build-time argümanları
ARG CAMUNDA_VERSION=7.22.0
ARG NEXUS_URL=http://18.157.182.187:32265/repository/camunda-raw
ARG NEXUS_USERNAME
ARG NEXUS_PASSWORD


# Çevresel değişkenler (container başlatılırken override edilebilir)
ENV CAMUNDA_VERSION=${CAMUNDA_VERSION}
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

# Kullanıcı oluştur
RUN addgroup -g 1000 -S cadenzaflow && \
    adduser -u 1000 -S cadenzaflow -G cadenzaflow -h /cadenzaflow -s /bin/bash -D cadenzaflow

# Cadenzaflow Tomcat dağıtımını Nexus'tan indir ve unpack et
RUN mkdir -p /cadenzaflow \
    && curl -f -L -u "${NEXUS_USERNAME}:${NEXUS_PASSWORD}" -o /tmp/cadenzaflow-bpm-tomcat.tar.gz \
       "${NEXUS_URL}/cadenzaflow-bpm-tomcat-${CAMUNDA_VERSION}.tar.gz" \
    && tar -xzf /tmp/cadenzaflow-bpm-tomcat.tar.gz -C /cadenzaflow --strip-components=2 \
    && rm /tmp/cadenzaflow-bpm-tomcat.tar.gz

# PostgreSQL JDBC driver'ını ekle (her ortamda fallback olmaması için)
ADD https://jdbc.postgresql.org/download/postgresql-42.7.3.jar /cadenzaflow/lib/postgresql-42.7.3.jar

# Çalışma dizini ve kullanıcıyı ayarla
WORKDIR /cadenzaflow
USER root

# Yardımcı scriptleri ve prometheus config dosyasını kopyala
COPY camunda-lib.sh /cadenzaflow/
COPY camunda-tomcat.sh /cadenzaflow/camunda.sh
COPY prometheus-jmx.yml /cadenzaflow/javaagent/prometheus-jmx.yml

# server.xml ve bpm-platform.xml'i build context'ten kopyala (JNDI ve fallback hatalarını önler)
COPY server.xml /cadenzaflow/conf/server.xml
COPY bpm-platform.xml /cadenzaflow/conf/bpm-platform.xml

# context.xml ve web.xml override gerekiyorsa (JNDI fallback için), build context'e ekle ve aşağıdaki satırların yorumunu kaldır:
# COPY context.xml /camunda/conf/context.xml
# COPY web.xml /camunda/webapps/camunda/WEB-INF/web.xml

# İzinleri ayarla ve kullanıcıyı değiştir
RUN chmod +x /cadenzaflow/*.sh \
    && mkdir -p /cadenzaflow/javaagent \
    && chown -R cadenzaflow:cadenzaflow /cadenzaflow


USER cadenzaflow

# Portu aç
EXPOSE 8080 9404

# Başlangıç komutu
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["./camunda.sh"]
