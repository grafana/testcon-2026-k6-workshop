import http from "k6/http";
import { check } from "k6";
import { SharedArray } from "k6/data";
import exec from "k6/execution";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3333";

export const options = {
  vus: 50,
  duration: "10s",
};

const users = new SharedArray("all users", function () {
  return JSON.parse(open("../data/users.json")).users;
});

export default function () {
  // Each VU consistently logs in as the same user for the whole test,
  // like a real user keeping a single session open, instead of hopping
  // between accounts on every iteration.
  const user = users[(exec.vu.idInTest - 1) % users.length];

  const loginData = {
    username: user.username,
    password: user.password,
  };
  let res = http.post(
    `${BASE_URL}/api/users/token/login`,
    JSON.stringify(loginData),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
  check(res, { "login status is 200": (res) => res.status === 200 });

  const token = res.json().token;
  const restrictions = {
    maxCaloriesPerSlice: 500,
    mustBeVegetarian: false,
    excludedIngredients: ["pepperoni"],
    excludedTools: ["knife"],
    maxNumberOfToppings: 6,
    minNumberOfToppings: 2,
  };
  res = http.post(`${BASE_URL}/api/pizza`, JSON.stringify(restrictions), {
    headers: {
      "Content-Type": "application/json",
      Authorization: `token ${token}`,
    },
  });
  check(res, { "pizza status is 200": (res) => res.status === 200 });
}
