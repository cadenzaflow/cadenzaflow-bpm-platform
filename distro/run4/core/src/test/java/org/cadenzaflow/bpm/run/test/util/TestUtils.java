/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH
 * under one or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information regarding copyright
 * ownership. Camunda licenses this file to you under the Apache License,
 * Version 2.0; you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.cadenzaflow.bpm.run.test.util;

import java.io.InputStream;
import java.security.KeyStore;

import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManagerFactory;

public class TestUtils {

  /**
   * Trusts the certificate of the test keystore (keystore.p12), which the
   * HTTPS tests serve, and no other.
   */
  public static void trustTestCertificate() throws Exception {
    KeyStore keyStore = KeyStore.getInstance("PKCS12");
    try (InputStream keyStoreFile = TestUtils.class.getResourceAsStream("/keystore.p12")) {
      keyStore.load(keyStoreFile, "cadenzaflow".toCharArray());
    }
    TrustManagerFactory trustManagerFactory = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
    trustManagerFactory.init(keyStore);
    SSLContext ctx = SSLContext.getInstance("TLS");
    ctx.init(null, trustManagerFactory.getTrustManagers(), null);
    SSLContext.setDefault(ctx);
  }
}
