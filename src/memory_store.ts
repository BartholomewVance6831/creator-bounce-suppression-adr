import type { DeliveryJournal, DeliveryRecord, SubscriberRecord, SubscriberUpdates } from "./creator_delivery.js";

export class InMemorySubscribers implements SubscriberUpdates {
  private records: Map<string, SubscriberRecord>;

  constructor(seed: SubscriberRecord[] = []) {
    this.records = new Map(seed.map((record) => [record.email, record]));
  }

  get(email: string): SubscriberRecord | undefined {
    return this.records.get(email);
  }

  save(record: SubscriberRecord): void {
    this.records.set(record.email, record);
  }
}

export class InMemoryDeliveryJournal implements DeliveryJournal {
  private records: Map<string, DeliveryRecord>;

  constructor(seed: DeliveryRecord[] = []) {
    this.records = new Map(seed.map((record) => [record.orderId, record]));
  }

  save(record: DeliveryRecord): void {
    this.records.set(record.orderId, record);
  }

  get(orderId: string): DeliveryRecord | undefined {
    return this.records.get(orderId);
  }
}
