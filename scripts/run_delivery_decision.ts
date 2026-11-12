import { deliverDigitalAsset } from "../src/creator_delivery.js";
import { InMemoryDeliveryJournal, InMemorySubscribers } from "../src/memory_store.js";

const buyerEmail = process.env.DEMO_EMAIL_TO;
if (!buyerEmail) {
  throw new Error("DEMO_EMAIL_TO is required");
}

const subscribers = new InMemorySubscribers();
const journal = new InMemoryDeliveryJournal();

const result = await deliverDigitalAsset(
  {
    orderId: "order_1001",
    assetId: "mixpack_v3",
    buyerEmail,
    creatorSlug: "north-coast-beats",
    downloadUrl: "https://creator.example/download/order_1001/mixpack_v3",
  },
  subscribers,
  journal,
);

console.log(JSON.stringify(result, null, 2));
