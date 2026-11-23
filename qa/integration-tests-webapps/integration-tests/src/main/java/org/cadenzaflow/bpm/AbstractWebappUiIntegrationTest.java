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
package org.cadenzaflow.bpm;

import java.net.URI;
import java.net.URISyntaxException;

import org.cadenzaflow.bpm.util.SeleniumScreenshotRule;
import org.junit.After;
import org.junit.AfterClass;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Rule;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.support.ui.ExpectedCondition;

public class AbstractWebappUiIntegrationTest extends AbstractWebIntegrationTest {

  protected static WebDriver driver;

  @Rule
  public SeleniumScreenshotRule screenshotRule = new SeleniumScreenshotRule(driver);

  @BeforeClass
  public static void createDriver() {
    ChromeOptions chromeOptions = new ChromeOptions()
        .addArguments("--headless=new")
        .addArguments("--window-size=1920,1200")
        .addArguments("--disable-gpu")
        .addArguments("--no-sandbox")
        .addArguments("--disable-dev-shm-usage")
        .addArguments("--remote-allow-origins=*");
    // Selenium fetches this version of Chrome ("Chrome for Testing") and its
    // driver, so the tests need no browser on the machine. Without the
    // property it takes the Chrome that is installed.
    String chromeVersion = System.getProperty("chrome.version");
    if (chromeVersion != null && !chromeVersion.isEmpty()) {
      chromeOptions.setBrowserVersion(chromeVersion);
    }

    driver = new ChromeDriver(chromeOptions);
  }

  public static ExpectedCondition<Boolean> currentURIIs(final URI pageURI) {

    return new ExpectedCondition<Boolean>() {
      @Override
      public Boolean apply(WebDriver webDriver) {
        try {
          return new URI(webDriver.getCurrentUrl()).equals(pageURI);
        } catch (URISyntaxException e) {
          return false;
        }
      }
    };

  }

  public static ExpectedCondition<Boolean> containsCurrentUrl(final String url) {

    return new ExpectedCondition<Boolean>() {
      @Override
      public Boolean apply(WebDriver webDriver) {
        return webDriver.getCurrentUrl().contains(url);
      }
    };

  }

  @Before
  public void createClient() throws Exception {
    preventRaceConditions();
    createClient(getWebappCtxPath());
    appUrl = testProperties.getApplicationPath("/" + getWebappCtxPath());
  }

  @AfterClass
  public static void quitDriver() {
    driver.quit();
  }

}
