/**
 * browser-test.js, extended with a custom timing metric: Web Vitals measure
 * generic page-load performance, but "how long from clicking the button to
 * the recommendation actually showing up" is a business-specific timing
 * Web Vitals don't cover. window.performance.mark/measure (the standard
 * browser User Timing API) lets you bracket exactly that, and a k6 Trend
 * reports it as a metric like any other.
 */
import { browser } from "k6/browser";
import { check } from "k6";
import { Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3333";

// the true param indicates the metric stores time values
const pizzaRecommendationTime = new Trend("pizza_recommendation_time", true);

export const options = {
  scenarios: {
    browser_ux: {
      exec: "checkPizzaRecommendation",
      executor: "shared-iterations",
      options: {
        browser: { type: "chromium" },
      },
    },
  },
};

export async function checkPizzaRecommendation() {
  const page = await browser.newPage();
  try {
    await page.goto(BASE_URL, { waitUntil: "load" });

    // Mark right after the click resolves, not before: click() itself
    // internally waits for the button to become actionable, and that wait
    // is automation overhead, not something a real user experiences. Marking
    // before the click would fold that wait into the measurement below.
    const button = page.locator('button[name="pizza-please"]');
    await button.click();
    await page.evaluate(() => window.performance.mark("click-pizza-button"));
    await page.locator("#recommendations").waitFor({ state: "visible" });
    await page.evaluate(() => window.performance.mark("recommendation-visible"));

    // measure() creates a third entry spanning the two marks. k6 doesn't
    // pick this up on its own - pull the duration back out with
    // page.evaluate() and report it yourself.
    await page.evaluate(() =>
      window.performance.measure(
        "pizza-recommendation-time",
        "click-pizza-button",
        "recommendation-visible",
      ),
    );
    const duration = await page.evaluate(
      () =>
        JSON.parse(
          JSON.stringify(window.performance.getEntriesByName("pizza-recommendation-time")),
        )[0].duration,
    );
    pizzaRecommendationTime.add(duration);

    const heading = await page.locator("#pizza-name").textContent();
    check(heading, { "recommendation rendered": (h) => h && h.length > 0 });
  } finally {
    await page.close();
  }
}
