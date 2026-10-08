/*
 * Copyright 2002-present the original author or authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package org.springframework.web.servlet.view.xslt;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import org.springframework.context.ApplicationContextException;
import org.springframework.context.support.StaticApplicationContext;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * CVE-2026-47884: XsltView must refuse stylesheet locations that point outside
 * the application (URLs, traversal, WEB-INF/META-INF, encoded variants).
 * Runs against the patched class; with the official 6.2.19 jar these fail.
 */
class XsltViewStylesheetLocationTests {

	@ParameterizedTest
	@ValueSource(strings = {
			"http://127.0.0.1:9/evil.xsl",          // SSRF to an internal address
			"file:/etc/passwd",                      // local file read
			"url:http://127.0.0.1:9/evil.xsl",
			"classpath:../evil.xsl",                 // traversal
			"/org/springframework/../../evil.xsl",
			"/WEB-INF/../../evil.xsl",
			"META-INF/evil.xsl",
			"%2e%2e/evil.xsl",                       // encoded traversal
			"%252e%252e/evil.xsl"                    // double-encoded traversal
	})
	void rejectsStylesheetLocationsOutsideTheApplication(String location) {
		XsltView view = new XsltView();
		view.setUrl(location);

		assertThatThrownBy(() -> view.setApplicationContext(new StaticApplicationContext()))
				.isInstanceOf(ApplicationContextException.class)
				.hasMessageContaining("Invalid XSLT stylesheet location");
	}

	@ParameterizedTest
	@ValueSource(strings = {
			"/org/springframework/web/servlet/view/xslt/products.xsl",
			"org/springframework/web/servlet/view/xslt/products.xsl",
			"//org//springframework/web/servlet/view/xslt/products.xsl"   // normalised, still allowed
	})
	void keepsLoadingStylesheetsFromTheApplication(String location) {
		XsltView view = new XsltView();
		view.setUrl(location);
		view.setApplicationContext(new StaticApplicationContext());

		assertThat(view.getUrl()).isEqualTo(location);
	}
}
