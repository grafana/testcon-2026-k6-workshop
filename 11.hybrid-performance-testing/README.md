# Hybrid performance testing

_**Need help?** Raise your hand and we'll come help._

Every test so far has measured one side of the system: the backend (HTTP, WebSocket, database).

You might also need to measure the real user (browser) experience at a moment of peak traffic.

Running load tests with real browsers at scale is costly and hard to set up. A browser VU is a real Chromium instance, not a lightweight HTTP request.

An alternative is a hybrid performance test: a browser check to validate user experience or performance, running alongside a stress test against the backend. It shows whether backend load actually reaches the person clicking the button, not just whether the API responded fast on its own.

## Part 1: A simple browser test

k6's [`browser`](https://grafana.com/docs/k6/latest/javascript-api/k6-browser/) module drives a real (by default headless) Chromium instance, no separate Playwright setup.

Run [`browser-test.js`](./browser-test.js):

```bash
k6 run browser-test.js
```

It loads QuickPizza's homepage, clicks "Pizza, Please!", and checks that a recommendation renders. You didn't have to hand-write this: [k6 Studio](../07.test-recorders/) can record a real browser session and generate a script like this one for you. Try that if you'd rather build it that way.

Look at the **WEB_VITALS** block in the terminal summary. These are [Core Web Vitals](https://web.dev/articles/vitals), collected automatically from that one page load, with no extra instrumentation:

- **`browser_web_vital_lcp`** / **`fcp`**: how long the page took to paint its main content.
- **`browser_web_vital_cls`**: how much the layout shifted while loading.
- **`browser_web_vital_ttfb`**: time to first byte for the page itself.
- **`browser_web_vital_inp`**: Interaction to Next Paint, the time from clicking "Pizza, Please!" to the page actually responding.

There's no backend load yet, so treat these as your baseline.

## Part 2: Time a specific user journey

Web Vitals measure generic page performance, but sometimes you want to time something specific to your app, here, how long from clicking the button to the recommendation actually showing up. That's not a Web Vital. It's a business-specific timing you bracket yourself with the browser's [User Timing API](https://developer.mozilla.org/en-US/docs/Web/API/Performance_API/User_timing) (`window.performance.mark`/`measure`), the same one browser DevTools uses. k6 doesn't pick these up automatically; you read the measurement back out with `page.evaluate()` and report it yourself with a [custom metric](https://grafana.com/docs/k6/latest/using-k6-browser/metrics/).

In `browser-test.js`, mark right after the click resolves and again once the recommendation appears, measure between them, and report the duration:

```js
import { Trend } from "k6/metrics";

// the true param indicates the metric stores time values
const pizzaRecommendationTime = new Trend("pizza_recommendation_time", true);

// ... inside checkPizzaRecommendation(), around the existing click/waitFor:
await page.locator('button[name="pizza-please"]').click();
await page.evaluate(() => window.performance.mark("click-pizza-button"));
await page.locator("#recommendations").waitFor({ state: "visible" });
await page.evaluate(() => window.performance.mark("recommendation-visible"));

await page.evaluate(() =>
  window.performance.measure("pizza-recommendation-time", "click-pizza-button", "recommendation-visible"),
);
const duration = await page.evaluate(
  () => JSON.parse(JSON.stringify(window.performance.getEntriesByName("pizza-recommendation-time")))[0].duration,
);
pizzaRecommendationTime.add(duration);
```

Mark after `click()` resolves, not before. `click()` internally waits for the button to become actionable (visible, stable, receiving events), and that wait isn't part of what you're trying to measure here.

Run it again. `pizza_recommendation_time` shows up under **CUSTOM** in the terminal summary, right alongside the Web Vitals from Part 1.

Stuck, or want to check your version against a working one? [`answer/browser-test.js`](./answer/browser-test.js) has the complete solution.

## Part 3: Turn it into a hybrid test

Add a second scenario to `browser-test.js` that generates backend load on the same endpoint the UI itself calls, reusing [lab 8](../08.test-result-visualization/)'s `POST /api/pizza` request.

Wire it up as a `backend_load` scenario alongside `browser_ux` in `options.scenarios`, using a `ramping-vus` executor to build up load (up to 50 VUs, say). Delay `browser_ux`'s `startTime` until `backend_load` has ramped up, so you're measuring the site already under load, not a cold start. Keep the browser VU count small; 10% or less of the protocol-level one is a good rule of thumb, since a browser VU costs far more than an HTTP one.

Run it:

```bash
k6 run hybrid-test.js
```

Then check either signal against your Part 1/2 baseline:

- **User experience**: does `"recommendation rendered"` still pass 100% of the time under load?
- **Performance**: does `pizza_recommendation_time`, the custom metric from Part 2, move compared to the baseline you measured with no backend load at all? It's the most direct signal here, since the click that starts it fires the exact same `POST /api/pizza` call `backend_load` is hammering concurrently.

k6's browser metrics land in Prometheus the same way everything else in this workshop has: `k6_pizza_recommendation_time_p99`, `k6_browser_web_vital_lcp_p99`, and so on. Query them in **Explore** or **Drilldown → Metrics** right alongside `backend_load`'s own `k6_http_req_duration`.

### Try it yourself

Change `backend_load`'s `target`, try 10, then 150, and run the hybrid test again each time. Does `pizza_recommendation_time` move the way you'd expect as concurrent backend load changes? On a single local machine, competing factors (CPU, DB connections, injected delays) can make the relationship noisier than the theory suggests. That's worth noticing too: a hybrid test tells you what's actually happening, not what should be happening.

## Related Resources

- [k6 Documentation: k6 browser](https://grafana.com/docs/k6/latest/javascript-api/k6-browser/)
- [k6 Documentation: Hybrid approach to performance](https://grafana.com/docs/k6/latest/using-k6-browser/recommended-practices/hybrid-approach-to-performance/)
- [web.dev: Core Web Vitals](https://web.dev/articles/vitals)
- [k6 Documentation: Send k6 results to Prometheus](https://grafana.com/docs/k6/latest/results-output/real-time/prometheus-remote-write/)

---

[← Previous exercise](../10.testing-beyond-http/) · [Workshop homepage](https://github.com/grafana/testcon-2026-k6-workshop)
