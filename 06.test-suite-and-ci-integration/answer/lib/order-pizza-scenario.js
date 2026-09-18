import http from "k6/http";
import { check } from "k6";

export function orderPizza(baseUrl) {
  const loginData = {
    username: "default",
    password: "12345678",
  };
  let res = http.post(
    `${baseUrl}/api/users/token/login`,
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
  res = http.post(`${baseUrl}/api/pizza`, JSON.stringify(restrictions), {
    headers: {
      "Content-Type": "application/json",
      Authorization: `token ${token}`,
    },
  });
  check(res, { "pizza status is 200": (res) => res.status === 200 });
}
