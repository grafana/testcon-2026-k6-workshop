# Test suite structure & CI/CD integration

_**Need help?** Raise your hand and we'll come help._

So far, every script has been a single file, and every test has run once, by hand. In this exercise, you'll extract the whole pizza-ordering flow into a reusable module, use it to build two load tests at different concurrency levels, and wire both into a GitHub Actions pipeline.

The full solution is under [`answer/`](./answer/) if you want to check your work or skip ahead. `scripts/lib/` and `scripts/tests/` are provided empty: they're your own workspace for this exercise, and their contents aren't committed to this repo.

## Part 1: Modularize the scenario, build two load tests

Open [`k6-test.js`](./k6-test.js). It logs in as `default` / `12345678` and then requests a pizza recommendation with the returned token, all inline in one `default function`.

A single "load test" rarely covers what a real service faces, though. A normal day and a much busier one stress a system differently, and you'll want to test both. Copy-pasting this script and only changing `options` gets you there, but then the flow (login + order a pizza) is duplicated everywhere it's used.

Extract it into one module instead. k6 supports plain ES module imports between local files, resolved by file path (not by a Node-style `node_modules` lookup, so `import _ from 'lodash'` won't work without a full path or URL).

Create `scripts/lib/order-pizza-scenario.js`, moving the whole flow into an exported function:

```js
import http from "k6/http";
import { check } from "k6";

export function orderPizza(baseUrl) {
  const loginData = { username: "default", password: "12345678" };
  let res = http.post(`${baseUrl}/api/users/token/login`, JSON.stringify(loginData), {
    headers: { "Content-Type": "application/json" },
  });
  check(res, { "login status is 200": (res) => res.status === 200 });

  const token = res.json().token;
  // ... request a pizza with the token, same as before
}
```

Now create two entry scripts under `scripts/tests/` that both import `orderPizza`, but each define their own `options`:

```
06.test-suite-and-ci-integration/
  scripts/
    lib/
      order-pizza-scenario.js   # the shared flow: login + order a pizza
    tests/
      standard-load-test.js    # a normal day: 10 concurrent users
      peak-traffic-test.js     # a busier day: 50 concurrent users
```

`standard-load-test.js` ramps a modest number of VUs up, holds, and ramps down: the steady concurrent baseline you'd expect on a normal day, like 10 users.

```js
import { orderPizza } from "../lib/order-pizza-scenario.js";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3333";

export const options = {
  stages: [
    { duration: "10s", target: 10 },
    { duration: "30s", target: 10 },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  orderPizza(BASE_URL);
}
```

Now write `peak-traffic-test.js` yourself, importing the same `orderPizza` flow. Same shape, ramping up, holding, and ramping down, but at a notably higher concurrency than `standard-load-test.js`, enough to see how the system holds up under a busier day, not just a normal one.

One module, two concurrency levels. The flow you're testing and the load you're testing it with are two separate concerns.

k6 resolves that `../lib/order-pizza-scenario.js` import itself at run time, so there's no build step involved: no `npm install`, no bundler. Run either test exactly like every other script so far in this workshop:

```bash
k6 run scripts/tests/standard-load-test.js
```

CLI flags also take priority over whatever `options` sets in the script, so you can override the load for a one-off run without editing the file:

```bash
k6 run --vus 5 --duration 10s scripts/tests/standard-load-test.js
```

This replaces the script's `stages` entirely. Instead of ramping up, holding, and ramping down, it runs a flat 5 VUs for 10 seconds. Handy for a quick smoke check before committing to the full ramp.

### A structure that scales

`scripts/lib/` and `scripts/tests/` are the smallest version of this pattern: one shared module, two entry points. A real test suite tends to grow in the same two directions, more reusable pieces and more scenarios built from them:

```
scripts/
  utils/
    auth.js         # login, token refresh, anything every scenario needs
    config.js       # shared constants: base URLs, default headers
  scenarios/
    checkout.js     # a full user flow: browse, add to cart, pay
    search.js       # another flow, reusing utils/auth.js
  tests/
    smoke-test.js    # 1 VU, 1 iteration, imports one scenario
    load-test.js     # steady traffic, imports one or more scenarios
    stress-test.js   # pushes past normal capacity
```

Entry scripts under `tests/` stay thin: import from `scenarios/` and `utils/`, and define `options`. The actual request logic lives in one place regardless of how many load profiles you end up testing it with.

Finally, create a `utils/config.js` file to hold the standard and peak VU load as settings and import them into test files, instead of hardcoding the numbers in each test:

```js
// utils/config.js
export const load = {
  STANDARD_VUS: 10,
  PEAK_VUS: 50,
};
```

## Part 2: Run the full suite before a release

Load tests aren't unit tests. `peak-traffic-test.js` alone takes 50 seconds and puts real traffic on a real target. Running both tests on every push or pull request, the way you'd run a fast unit test suite, slows down every commit for a signal most changes don't need, and hammers whatever `BASE_URL` points at dozens of times a day. Save the full suite for the moments that actually call for it: a pre-release check, or on demand.

[`grafana/setup-k6-action`](https://github.com/grafana/setup-k6-action) installs the k6 binary in a GitHub Actions runner. [`grafana/run-k6-action`](https://github.com/grafana/run-k6-action) is a wrapper over `k6 run` that discovers scripts by glob or list, can run them in parallel, and can fail the pipeline on the first failing test.

Open [`.github/workflows/k6-ci.yml`](../.github/workflows/k6-ci.yml):

```yaml
name: k6 pre-release load test

on:
  push:
    tags:
      - "v*"
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: grafana/setup-k6-action@v1
      - uses: grafana/run-k6-action@v1
        with:
          path: |
            06.test-suite-and-ci-integration/answer/tests/standard-load-test.js
            06.test-suite-and-ci-integration/answer/tests/peak-traffic-test.js
          parallel: true
          flags: -e BASE_URL=https://quickpizza.grafana.com
```

A couple of things to notice:

- It runs on version tags, not every push. `on.push.tags: ["v*"]` fires only when you push a tag like `v1.2.0`, the moment you're cutting a release, not every commit to a branch. `workflow_dispatch` adds a manual "Run workflow" button in the Actions tab, for whenever you want the full suite without waiting for a tag.
- It targets `answer/`, not `scripts/`. `scripts/lib/` and `scripts/tests/` are your own workspace and gitignored, so they're never committed. Pointing CI there would fail on a fresh clone or fork with nothing to run.
- The workflow overrides `BASE_URL` to point at the public `https://quickpizza.grafana.com` demo instead of `localhost`, since the CI runner doesn't have your local Docker Compose stack running.
- Thresholds gate the pipeline. Each test's `http_req_failed: ["rate<0.01"]` threshold makes `k6 run` exit non-zero on a breach, same as [lab 4](../04.assertions/), except now it turns the GitHub Actions job red instead of just failing in your terminal.

If you also want fast, per-PR feedback, that's a different, smaller job: a short smoke test (one or a few iterations) triggered `on: pull_request`, checking the tests and app still respond correctly. Not a substitute for the pre-release performance test, just a sanity check.

### Run the workflow locally before pushing

[`act`](https://github.com/nektos/act) runs a GitHub Actions workflow on your machine using Docker containers that emulate the real runner, so you can iterate without waiting on a push and a CI queue. It's already wired up as an `act` container in this repo's `docker compose up`, nothing to install beyond Docker.

```bash
docker compose up -d
docker compose exec act act -j load-test
```

It checks out the repo, then runs `grafana/setup-k6-action` and `grafana/run-k6-action`, the exact same steps GitHub would run, using your host's Docker daemon to spin up the job containers.

If you have extra time, add an `http_req_duration` threshold to one of the tests, strict enough that real traffic against `quickpizza.grafana.com` won't meet it, and watch that check fail.

## Related Resources

- [k6 Documentation: Modules](https://grafana.com/docs/k6/latest/using-k6/modules/)
- [k6 Documentation: Automated performance testing](https://grafana.com/docs/k6/latest/testing-guides/automated-performance-testing/)

---

[← Previous exercise](../05.parameterized-data/) · [Workshop homepage](https://github.com/grafana/testcon-2026-k6-workshop) · [Next exercise →](../07.test-recorders/)
