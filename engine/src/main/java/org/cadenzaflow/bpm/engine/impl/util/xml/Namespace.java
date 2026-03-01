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
package org.cadenzaflow.bpm.engine.impl.util.xml;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * Represents an XML namespace with an optional list of alternative (legacy) URIs.
 * Supports multiple alternative URIs to enable backward compatibility across engine
 * rebrands (e.g. Activiti → Camunda → CadenzaFlow).
 *
 * @author Ronny Bräunlich
 */
public class Namespace {

  private final String namespaceUri;
  private final List<String> alternativeUris;

  public Namespace(String namespaceUri) {
    this.namespaceUri = namespaceUri;
    this.alternativeUris = Collections.emptyList();
  }

  /**
   * Creates a namespace with one alternative URI (backward compatibility).
   *
   * @param namespaceUri   the primary namespace URI
   * @param alternativeUri a single legacy/alternative namespace URI
   */
  public Namespace(String namespaceUri, String alternativeUri) {
    this.namespaceUri = namespaceUri;
    this.alternativeUris = alternativeUri != null
        ? Collections.singletonList(alternativeUri)
        : Collections.emptyList();
  }

  /**
   * Creates a namespace with multiple alternative URIs.
   * Allows the engine to support several legacy namespace URIs simultaneously
   * (e.g. Activiti, Camunda, and CadenzaFlow namespaces).
   *
   * @param namespaceUri    the primary namespace URI
   * @param alternativeUris zero or more legacy/alternative namespace URIs
   */
  public Namespace(String namespaceUri, String... alternativeUris) {
    this.namespaceUri = namespaceUri;
    this.alternativeUris = alternativeUris != null && alternativeUris.length > 0
        ? Collections.unmodifiableList(Arrays.asList(alternativeUris))
        : Collections.emptyList();
  }

  /**
   * Returns {@code true} if this namespace has at least one alternative URI.
   */
  public boolean hasAlternativeUri() {
    return !alternativeUris.isEmpty();
  }

  public String getNamespaceUri() {
    return namespaceUri;
  }

  /**
   * Returns the first alternative URI for single-alternative backward compatibility.
   *
   * @deprecated Use {@link #getAlternativeUris()} to iterate over all alternatives.
   */
  @Deprecated
  public String getAlternativeUri() {
    return alternativeUris.isEmpty() ? null : alternativeUris.get(0);
  }

  /**
   * Returns an unmodifiable list of all alternative namespace URIs.
   */
  public List<String> getAlternativeUris() {
    return alternativeUris;
  }

  @Override
  public int hashCode() {
    final int prime = 31;
    int result = 1;
    result = prime * result + ((namespaceUri == null) ? 0 : namespaceUri.hashCode());
    return result;
  }

  @Override
  public boolean equals(Object obj) {
    if (this == obj)
      return true;
    if (obj == null)
      return false;
    if (getClass() != obj.getClass())
      return false;
    Namespace other = (Namespace) obj;
    if (namespaceUri == null) {
      if (other.namespaceUri != null)
        return false;
    } else if (!namespaceUri.equals(other.namespaceUri))
      return false;
    return true;
  }

}
