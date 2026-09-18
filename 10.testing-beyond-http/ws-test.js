/**
 * QuickPizza's homepage shows a live counter of pizzas other visitors are
 * generating right now. Every time someone gets a recommendation, the
 * frontend sends {ws_visitor_id, msg: "new_pizza"} over /ws, and the server
 * broadcasts it back to every connected client - including the sender
 * (see pkg/http/http.go's melody.Broadcast).
 *
 * This test simulates one visitor connecting and sending that same event,
 * then waits for it to come back through the broadcast before disconnecting -
 * proving the round trip through the server actually completes, and timing
 * it. It also pings the connection directly, a second, simpler signal of
 * whether the server is still responsive.
 */
import { WebSocket } from "k6/websockets";
import { setTimeout, clearTimeout } from "k6/timers";
import { check, sleep } from "k6";

const WS_URL = "ws://localhost:3333/ws";

export const options = {
  vus: 20,
  duration: "20s",
};

export default function () {
  const visitorId = `${__VU}-${__ITER}`;
  const payload = JSON.stringify({ ws_visitor_id: visitorId, msg: "new_pizza" });
  let receivedOwnBroadcast = false;
  let receivedPong = false;

  const ws = new WebSocket(WS_URL);

  // Only close once both signals are in - closing as soon as either one
  // arrives would race with the other and understate its check.
  function closeWhenDone() {
    if (receivedOwnBroadcast && receivedPong) {
      clearTimeout(timeoutId);
      ws.close();
    }
  }

  ws.addEventListener("open", () => {
    ws.send(payload);
    ws.ping();
  });

  // Every connected client sees every broadcast, not just its own message -
  // ignore anyone else's and only react once ours comes back.
  ws.addEventListener("message", (e) => {
    const data = JSON.parse(e.data);
    if (data.ws_visitor_id === visitorId) {
      receivedOwnBroadcast = true;
      closeWhenDone();
    }
  });

  ws.addEventListener("pong", () => {
    receivedPong = true;
    closeWhenDone();
  });

  // Safety net in case either signal never comes back - without clearing
  // this timer above, the iteration would pad out to a full 3s even after
  // closing early, since k6 waits for every pending timer before ending
  // the iteration.
  const timeoutId = setTimeout(() => ws.close(), 3000);

  ws.addEventListener("close", () => {
    check(receivedOwnBroadcast, { "broadcast came back": (v) => v });
    check(receivedPong, { "ping replied with pong": (v) => v });
  });

  // Runs before the socket even opens - WebSocket calls are async callbacks,
  // so this synchronous sleep executes first. It paces iterations to roughly
  // one new connection per VU per second, instead of hammering the endpoint
  // in a tight loop.
  sleep(1);
}
