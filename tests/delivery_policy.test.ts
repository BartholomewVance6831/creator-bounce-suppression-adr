import test from "node:test";
import assert from "node:assert/strict";
import { decideDelivery } from "../src/delivery_policy.js";

test("suppressed subscriber does not receive a delivery email", () => {
  const decision = decideDelivery({
    orderId: "order_77",
    assetId: "preset_pack",
    email: "bounced@example.com",
    suppressed: true,
  });

  assert.equal(decision.sendEmail, false);
  assert.equal(decision.nextSubscriber.status, "suppressed");
  assert.equal(decision.nextSubscriber.suppressionReason, "hard_bounce");
  assert.deepEqual(decision.nextDelivery, {
    orderId: "order_77",
    assetId: "preset_pack",
    email: "bounced@example.com",
    state: "suppressed",
    note: "recipient already suppressed",
  });
});
