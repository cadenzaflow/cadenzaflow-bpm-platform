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
package org.cadenzaflow.bpm.dmn.engine.feel;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.entry;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.cadenzaflow.bpm.dmn.engine.feel.helper.FeelRule;
import org.junit.Rule;
import org.junit.Test;

/**
 * FEEL list and context results must be materialized as portable JDK collections. Without
 * materialization they surface as shaded Scala bridge wrappers
 * ({@code camundajar.impl.scala.collection.convert.JavaCollectionWrappers$SeqWrapper} etc.),
 * and that concrete class ends up as the {@code objectTypeName} of any serialized process
 * variable holding the result — a class no external consumer can load, so every typed
 * external-task client read of such a variable fails.
 */
public class PortableCollectionTypesTest {

  @Rule
  public FeelRule feelRule = FeelRule.build();

  @Test
  public void shouldMaterializeListLiteralAsArrayList() {
    // when
    Object result = feelRule.evaluateExpression("[\"email\", \"inbox\"]");

    // then
    assertThat(result).isExactlyInstanceOf(ArrayList.class);
    assertThat((List<Object>) result).containsExactly("email", "inbox");
  }

  @Test
  public void shouldMaterializeContextLiteralAsLinkedHashMap() {
    // when
    Object result = feelRule.evaluateExpression("{channels: [\"email\"], priority: \"high\"}");

    // then
    assertThat(result).isExactlyInstanceOf(LinkedHashMap.class);

    Map<Object, Object> context = (Map<Object, Object>) result;
    assertThat(context).containsEntry("priority", "high");
    assertThat(context.get("channels")).isExactlyInstanceOf(ArrayList.class);
    assertThat((List<Object>) context.get("channels")).containsExactly("email");
  }

  @Test
  public void shouldMaterializeNestedCollectionsDeeply() {
    // when
    Object result = feelRule.evaluateExpression(
        "[{channel: \"email\", tags: [\"a\", \"b\"]}, {channel: \"inbox\", tags: []}]");

    // then
    assertThat(assertPortable(result)).isTrue();

    List<?> list = (List<?>) result;
    Map<Object, Object> first = (Map<Object, Object>) list.get(0);
    assertThat(first).contains(entry("channel", "email"));
    assertThat((List<Object>) first.get("tags")).containsExactly("a", "b");
  }

  @Test
  public void shouldMaterializeListDerivedFromInputVariable() {
    // given
    List<String> input = Arrays.asList("email", "inbox", "sms");

    // when
    Object result = feelRule.evaluateExpression("variable[item != \"sms\"]", input);

    // then
    assertThat(result).isExactlyInstanceOf(ArrayList.class);
    assertThat((List<Object>) result).containsExactly("email", "inbox");
  }

  @Test
  public void shouldNotWrapScalarResults() {
    // when
    Object result = feelRule.evaluateExpression("\"email\"");

    // then
    assertThat(result).isEqualTo("email");
  }

  /**
   * Asserts that every collection in the result tree is a plain JDK class — i.e. loadable by
   * a consumer that only has the JDK, which is exactly what a typed external-task client
   * reconstructing {@code objectTypeName} requires.
   */
  protected boolean assertPortable(Object value) {
    if (value instanceof List || value instanceof Map) {
      assertThat(value.getClass().getName()).startsWith("java.util.");
    }
    if (value instanceof List) {
      for (Object element : (List<?>) value) {
        assertPortable(element);
      }
    } else if (value instanceof Map) {
      for (Object element : ((Map<?, ?>) value).values()) {
        assertPortable(element);
      }
    }
    return true;
  }

}
