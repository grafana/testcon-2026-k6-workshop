# Parameterize test data

_**Need help?** Raise your hand and we'll come help._

In this exercise, you'll parameterize a login flow so that every virtual user (VU) authenticates as a distinct, real user instead of everyone sharing the same account.

Open [`k6-test.js`](./k6-test.js). It logs in as the built-in `default` user and then uses the returned token to request a pizza recommendation:

1. `POST /api/users/token/login` with `default` / `12345678`, returning an auth token.
2. `POST /api/pizza` using that token to authenticate the request.

Run it with 50 VUs:

```bash
k6 run k6-test.js
```

Every VU logs in and requests a pizza as the exact same `default` account. That's not how real traffic looks: 50 concurrent users means 50 distinct accounts.

## Part 1: Parameterize the data

[`data/users.json`](./data/users.json) contains 100 seeded QuickPizza users (`user1`…`user100`, all with password `quickpizza`).

Load the file and pick a random user on every iteration instead of hardcoding `default`:

```js
const users = JSON.parse(open('./data/users.json')).users;

export default function () {
  const user = users[Math.floor(Math.random() * users.length)];

  const loginData = {
    username: user.username,
    password: user.password,
  };
  // ...
}
```

Run the test again. Add a `console.log(user.username)` if you want to confirm different users are picked across iterations.

## Part 2: Optimize with SharedArray

`open()` and `JSON.parse()` run once per VU during initialization. With 50 VUs, that's 50 separate copies of the same 100-user array sitting in memory. Harmless here, but wasteful (and slow to initialize) once test data grows into the thousands.

[`SharedArray`](https://grafana.com/docs/k6/latest/javascript-api/k6-data/sharedarray/) parses the file once and stores it in memory shared (read-only) across all VUs:

```js
import { SharedArray } from 'k6/data';

const users = new SharedArray('all users', function () {
  return JSON.parse(open('./data/users.json')).users;
});
```

Swap the plain array for `SharedArray` and keep the random selection from Part 1. Run the test again: same behavior, lower memory footprint.

## Part 3: Assign one user per VU

With `Math.random()`, a VU can log in as a **different** user on every iteration, and two VUs can pick the **same** user at the same time. Neither reflects a real session: a real user keeps one identity for as long as they're using the app.

The [`k6/execution`](https://grafana.com/docs/k6/latest/javascript-api/k6-execution/) module exposes `vu.idInTest`, a unique, stable integer identifying the current VU for the whole test run.

```js
import exec from 'k6/execution';

const user = users[(exec.vu.idInTest - 1) % users.length];
```

Because `idInTest` doesn't change between iterations, each VU now consistently logs in as the same user for its entire lifetime, and since it's unique per VU, no two VUs collide on the same account (as long as VUs ≤ users, 50 ≤ 100 here).

Update the script and run it again. Compare the result with Part 2: same throughput, but now the traffic maps to 50 distinct, stable user sessions instead of random shuffling.

If you have extra time, try setting `vus` above 100 and see what changes when VUs outnumber seeded users.

## Related Resources

- [k6 Documentation: SharedArray](https://grafana.com/docs/k6/latest/javascript-api/k6-data/sharedarray/)
- [k6 Documentation: k6/execution](https://grafana.com/docs/k6/latest/javascript-api/k6-execution/)
- [k6 Documentation: Data parameterization](https://grafana.com/docs/k6/latest/examples/data-parameterization/)

---

[← Previous exercise](../04.assertions/) · [Workshop homepage](https://github.com/grafana/testcon-2026-k6-workshop) · [Next exercise →](../06.test-suite-and-ci-integration/)
