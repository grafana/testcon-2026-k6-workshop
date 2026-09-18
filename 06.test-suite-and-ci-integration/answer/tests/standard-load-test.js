import { orderPizza } from "../lib/order-pizza-scenario.js";
import { load } from "../utils/config.js";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3333";

export const options = {
  stages: [
    { duration: "10s", target: load.STANDARD_VUS },
    { duration: "30s", target: load.STANDARD_VUS },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  orderPizza(BASE_URL);
}
