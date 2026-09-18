/**
 * A simple k6 browser test: load QuickPizza's homepage, click "Pizza,
 * Please!" - the same button a real visitor clicks - and check that a
 * recommendation actually renders. k6/browser reports Core Web Vitals
 * (LCP, FCP, CLS, TTFB, INP) for this page load automatically, no extra
 * instrumentation needed.
 *
 * You don't have to hand-write scripts like this one: k6 Studio (lab 7)
 * can record a real browser session and generate this for you. This
 * version is hand-written so every line is easy to follow.
 */
import { browser } from "k6/browser";
import { check } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3333";

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
    await page.locator('button[name="pizza-please"]').click();
    await page.locator("#recommendations").waitFor({ state: "visible" });
    const heading = await page.locator("#pizza-name").textContent();
    check(heading, { "recommendation rendered": (h) => h && h.length > 0 });
  } finally {
    await page.close();
  }
}
