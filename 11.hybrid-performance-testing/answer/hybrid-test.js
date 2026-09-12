/**
 * browser-test.js turned into a hybrid test: the same browser check, plus a
 * second `backend_load` scenario reusing lab 8's POST /api/pizza request to
 * generate traffic on the same endpoint the UI itself calls - so you can see
 * how that backend load actually affects the experience a user gets, not
 * just whether the API responded fast on its own.
 *
 * `browser_ux` now repeats for the length of the run instead of a single
 * shared iteration, sampling Core Web Vitals (LCP, FCP, CLS, TTFB, INP)
 * throughout the load window rather than once. INP - Interaction to Next
 * Paint, the time from the click to the page actually responding - is the
 * most direct signal here, since that click triggers the exact same backend
 * call `backend_load` is hammering concurrently.
 */
import { browser } from "k6/browser";
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3333";

// the true param indicates the metric stores time values
const pizzaRecommendationTime = new Trend("pizza_recommendation_time", true);

export const options = {
  scenarios: {
    backend_load: {
      exec: "generateBackendLoad",
      executor: "ramping-vus",
      stages: [
        { duration: "10s", target: 5 },
        { duration: "40s", target: 5 },
        { duration: "10s", target: 0 },
      ],
    },
    // Keep browser VUs to 10% or less of the protocol-level ones - a browser
    // VU costs far more (it's a real Chromium instance) than an HTTP one, so
    // most of the load should come from backend_load, not from this.
    // https://grafana.com/docs/k6/latest/using-k6-browser/recommended-practices/hybrid-approach-to-performance/
    browser_ux: {
      exec: "checkPizzaRecommendation",
      executor: "constant-vus",
      vus: 1,
      duration: "40s",
      // Starts after backend_load has ramped up to its target, so the
      // measurement reflects the site already under load - not a cold start.
      startTime: "10s",
      options: {
        browser: { type: "chromium" },
      },
    },
  },
};

export function generateBackendLoad() {
  const restrictions = {
    maxCaloriesPerSlice: 500,
    mustBeVegetarian: false,
    excludedIngredients: ["pepperoni"],
    excludedTools: ["knife"],
    maxNumberOfToppings: 6,
    minNumberOfToppings: 2,
  };
  const res = http.post(`${BASE_URL}/api/pizza`, JSON.stringify(restrictions), {
    headers: {
      "Content-Type": "application/json",
      Authorization: "token abcdef0123456789",
    },
  });
  check(res, { "pizza status is 200": (r) => r.status === 200 });
}

export async function checkPizzaRecommendation() {
  const page = await browser.newPage();
  try {
    await page.goto(BASE_URL, { waitUntil: "load" });

    // Mark right after the click resolves, not before: click() itself
    // internally waits for the button to become actionable, and that wait
    // is automation overhead, not something a real user experiences.
    await page.locator('button[name="pizza-please"]').click();
    await page.evaluate(() => window.performance.mark("click-pizza-button"));
    await page.locator("#recommendations").waitFor({ state: "visible" });
    await page.evaluate(() => window.performance.mark("recommendation-visible"));

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
  sleep(1);
}
