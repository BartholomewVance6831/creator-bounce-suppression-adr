import type { DeliveryRecord, SubscriberRecord } from "./creator_delivery.js";

export type DeliveryDecision = {
  sendEmail: boolean;
  nextSubscriber: SubscriberRecord;
  nextDelivery: DeliveryRecord;
};

export function decideDelivery(args: {
  orderId: string;
  assetId: string;
  email: string;
  suppressed: boolean;
  prior?: SubscriberRecord;
}): DeliveryDecision {
  if (args.suppressed) {
    return {
      sendEmail: false,
      nextSubscriber: {
        email: args.email,
        status: "suppressed",
        suppressionReason: "hard_bounce",
      },
      nextDelivery: {
        orderId: args.orderId,
        assetId: args.assetId,
        email: args.email,
        state: "suppressed",
        note: "recipient already suppressed",
      },
    };
  }

  return {
    sendEmail: true,
    nextSubscriber: {
      email: args.email,
      status: args.prior?.status === "suppressed" ? "active" : "active",
      lastMessageId: args.prior?.lastMessageId,
    },
    nextDelivery: {
      orderId: args.orderId,
      assetId: args.assetId,
      email: args.email,
      state: "sent",
      note: "delivery email accepted",
    },
  };
}
