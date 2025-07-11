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
ENV JMX_PROMETHEUS_CONF=/camunda/javaagent/prometheus-jmx.yml
ENV JMX_PROMETHEUS_PORT=9404

# Kullanıcı oluştur
RUN addgroup -g 1000 -S camunda && \
    adduser -u 1000 -S camunda -G camunda -h /camunda -s /bin/bash -D camunda

# Camunda Tomcat dağıtımını Nexus'tan indir ve unpack et
RUN mkdir -p /camunda \
    && curl -f -L -u "${NEXUS_USERNAME}:${NEXUS_PASSWORD}" -o /tmp/camunda-bpm-tomcat.tar.gz \
       "${NEXUS_URL}/camunda-bpm-tomcat-7.22.0.tar.gz" \
    && tar -xzf /tmp/camunda-bpm-tomcat.tar.gz -C /camunda --strip-components=2 \
    && rm /tmp/camunda-bpm-tomcat.tar.gz

# PostgreSQL JDBC driver'ını ekle (her ortamda fallback olmaması için)
ADD https://jdbc.postgresql.org/download/postgresql-42.7.3.jar /camunda/lib/postgresql-42.7.3.jar

# Çalışma dizini ve kullanıcıyı ayarla
WORKDIR /camunda
USER root

# Yardımcı scriptleri ve prometheus config dosyasını kopyala
COPY camunda-lib.sh /camunda/
COPY camunda-tomcat.sh /camunda/camunda.sh
COPY prometheus-jmx.yml /camunda/javaagent/prometheus-jmx.yml

# server.xml ve bpm-platform.xml'i build context'ten kopyala (JNDI ve fallback hatalarını önler)
COPY server.xml /camunda/conf/server.xml
COPY bpm-platform.xml /camunda/conf/bpm-platform.xml

# context.xml ve web.xml override gerekiyorsa (JNDI fallback için), build context'e ekle ve aşağıdaki satırların yorumunu kaldır:
# COPY context.xml /camunda/conf/context.xml
# COPY web.xml /camunda/webapps/camunda/WEB-INF/web.xml

# İzinleri ayarla ve kullanıcıyı değiştir
RUN chmod +x /camunda/*.sh \
    && mkdir -p /camunda/javaagent \
    && chown -R camunda:camunda /camunda

USER camunda

# Portu aç
EXPOSE 8080 9404

# Başlangıç komutu
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["./camunda.sh"]
