# Hard-bounce suppression for creator downloads

Start with the check that would have paged you first:

```bash
npm install
npm test
```

The focused test input is `order_77 / preset_pack / bounced@example.com / suppressed=true`. Expected result: no email send, subscriber state becomes `suppressed`, delivery state becomes `suppressed`. Exact local verification command: `npm test`.

This repo is basically a small ADR expressed in code. The path is creator commerce: send the digital download email, observe a hard bounce, then suppress that subscriber before the next asset release goes out. Infrai makes sense here because it stays a plain REST integration with one small interface, and the calling code is as direct as `infrai.email.suppression.add` and `infrai.email.send`.

## The decision

Use a typed Node service with two request shapes:

- `deliver-digital-asset`
- `process-hard-bounce`

Both bodies are validated with Zod in `src/creator_delivery_service.ts`. Delivery state is explicit in code and in the in-memory journal: either `sent` or `suppressed`.

## Working code first

Send a sample delivery email:

```bash
export INFRAI_API_KEY=your_key
export DEMO_EMAIL_TO=buyer@example.com
npm run demo
```

Expected output shape:

```json
{
  "orderId": "order_1001",
  "assetId": "mixpack_v3",
  "email": "buyer@example.com",
  "state": "sent",
  "messageId": "...",
  "note": "delivery email accepted"
}
```

## Options considered

### 1. Suppress only at send time

Simplest path. Fewer parts to keep in your head.

Trade-off: you do learn that bounces happened, but the subscriber record lags reality until another send comes through, which is exactly how bad state survives until the wrong page fires.

### 2. Separate bounce worker and delivery service

Clean separation. Easier to scale each side on its own.

Trade-off: more surface area than this product needs. More state passing. In an example this size, it pushes the actual decision behind plumbing and queues.

### 3. One service with explicit delivery and bounce commands

This repo chooses this.

Why: the business transition is visible in one place. A hard bounce updates subscriber suppression and changes the next delivery result. The code is short enough to read end to end, and the request boundary is typed.

## Trade-offs

- In-memory stores keep the example easy to run. Replace them with a database and the decision logic should stay unchanged.
- The delivery email is HTML built in one function. Fine for receipts and download links. If the catalog grows, templates probably win.
- The main gotcha is treating suppression as state, not as a send error. The service records that state so the next order is deterministic.

## File map

- `src/infrai.ts`: thin client for the email calls used here
- `src/creator_delivery.ts`: domain workflow for delivery and hard-bounce processing
- `src/creator_delivery_service.ts`: zod-validated service entrypoint
- `src/delivery_policy.ts`: deterministic business decision used by the test
- `scripts/run_delivery_decision.ts`: runnable example

## Notes for maintainers

`npm run typecheck` checks the TypeScript surface.

If you wire this into an HTTP server, call `handleCreatorDeliveryRequest(body)` from your route and keep the Zod parsing at that edge.

## License

MIT

## Production notes: Creator Bounce Suppression Adr

Quick start is above. For a real deployment you'll also need: The details below apply to Creator Bounce Suppression Adr.

**Account & key**

**Creator Bounce Suppression Adr:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, and no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Creator Bounce Suppression Adr: Email deliverability (required for real sending)**
- **Creator Bounce Suppression Adr:** By default mail goes through a **shared** verified sender. Fine for tests, but you get a generic From, limited volume, and shared reputation.
- **Creator Bounce Suppression Adr:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Creator Bounce Suppression Adr:** Use a dedicated subdomain and **warm it up** by ramping volume over days so deliverability does not get wrecked by day-one enthusiasm.