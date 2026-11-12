import { z } from "zod";
import { deliverDigitalAsset, processHardBounce } from "./creator_delivery.js";
import { InMemoryDeliveryJournal, InMemorySubscribers } from "./memory_store.js";

const DeliveryHttpRequest = z.object({
  kind: z.literal("deliver-digital-asset"),
  orderId: z.string().min(1),
  assetId: z.string().min(1),
  buyerEmail: z.string().email(),
  creatorSlug: z.string().min(1),
  downloadUrl: z.string().url(),
});

const BounceHttpRequest = z.object({
  kind: z.literal("process-hard-bounce"),
  messageId: z.string().min(1),
  expectedEmail: z.string().email(),
});

const ServiceRequest = z.union([DeliveryHttpRequest, BounceHttpRequest]);

const subscribers = new InMemorySubscribers();
const journal = new InMemoryDeliveryJournal();

export async function handleCreatorDeliveryRequest(body: unknown) {
  const request = ServiceRequest.parse(body);

  if (request.kind === "deliver-digital-asset") {
    return deliverDigitalAsset(request, subscribers, journal);
  }

  // ServiceRequest.parse guarantees these fields for the bounce branch.
  return processHardBounce(
    { messageId: request.messageId!, expectedEmail: request.expectedEmail! },
    subscribers,
  );
}
