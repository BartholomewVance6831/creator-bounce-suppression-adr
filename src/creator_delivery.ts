import { z } from "zod";
import { infrai } from "./infrai.js";

export const DigitalAssetDeliveryRequest = z.object({
  orderId: z.string().min(1),
  assetId: z.string().min(1),
  buyerEmail: z.string().email(),
  creatorSlug: z.string().min(1),
  downloadUrl: z.string().url(),
});

export type DigitalAssetDeliveryRequest = z.infer<typeof DigitalAssetDeliveryRequest>;

export type SubscriberRecord = {
  email: string;
  status: "active" | "suppressed";
  suppressionReason?: string;
  lastMessageId?: string;
};

export type DeliveryRecord = {
  orderId: string;
  assetId: string;
  email: string;
  state: "sent" | "suppressed";
  messageId?: string;
  note: string;
};

export interface SubscriberUpdates {
  get(email: string): SubscriberRecord | undefined;
  save(record: SubscriberRecord): void;
}

export interface DeliveryJournal {
  save(record: DeliveryRecord): void;
  get(orderId: string): DeliveryRecord | undefined;
}

export async function deliverDigitalAsset(
  input: DigitalAssetDeliveryRequest,
  subscribers: SubscriberUpdates,
  journal: DeliveryJournal,
): Promise<DeliveryRecord> {
  const request = DigitalAssetDeliveryRequest.parse(input);

  const suppression = await infrai.email.suppression.check(request.buyerEmail);
  if (suppression.data.suppressed) {
    const blocked: DeliveryRecord = {
      orderId: request.orderId,
      assetId: request.assetId,
      email: request.buyerEmail,
      state: "suppressed",
      note: "recipient already suppressed",
    };
    subscribers.save({
      email: request.buyerEmail,
      status: "suppressed",
      suppressionReason: "hard_bounce",
    });
    journal.save(blocked);
    return blocked;
  }

  const sent = await infrai.email.send(
    {
      to: request.buyerEmail,
      subject: `${request.creatorSlug} download for order ${request.orderId}`,
      html: renderDownloadEmail(request),
    },
    `deliver:${request.orderId}`,
  );

  const record: DeliveryRecord = {
    orderId: request.orderId,
    assetId: request.assetId,
    email: request.buyerEmail,
    state: "sent",
    messageId: sent.data.message_id,
    note: "delivery email accepted",
  };

  subscribers.save({
    email: request.buyerEmail,
    status: "active",
    lastMessageId: sent.data.message_id,
  });
  journal.save(record);
  return record;
}

export async function processHardBounce(
  input: { messageId: string; expectedEmail: string },
  subscribers: SubscriberUpdates,
): Promise<{ email: string; state: "suppressed" | "unchanged" }> {
  const events = await infrai.email.event.list(input.messageId);
  const hardBounce = events.data.items.find((event) => {
    const type = String(event.type ?? "").toLowerCase();
    const recipient = String(event.recipient ?? "").toLowerCase();
    return type.includes("bounce") && recipient === input.expectedEmail.toLowerCase();
  });

  if (!hardBounce) {
    return { email: input.expectedEmail, state: "unchanged" };
  }

  await infrai.email.suppression.add(
    { email: input.expectedEmail, reason: "hard_bounce" },
    `suppress:${input.messageId}`,
  );

  subscribers.save({
    email: input.expectedEmail,
    status: "suppressed",
    suppressionReason: "hard_bounce",
    lastMessageId: input.messageId,
  });

  return { email: input.expectedEmail, state: "suppressed" };
}

export function renderDownloadEmail(input: DigitalAssetDeliveryRequest): string {
  return [
    `<h1>Your download is ready</h1>`,
    `<p>Creator: ${escapeHtml(input.creatorSlug)}</p>`,
    `<p>Order: ${escapeHtml(input.orderId)}</p>`,
    `<p>Asset: ${escapeHtml(input.assetId)}</p>`,
    `<p><a href="${escapeHtml(input.downloadUrl)}">Open download</a></p>`,
  ].join("");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
