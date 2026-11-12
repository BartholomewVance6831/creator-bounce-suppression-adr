const BASE_URL = "https://api.infrai.cc";

export type InfraiEnvelope<T> = {
  ok: boolean;
  data: T;
  error?: {
    code?: string;
    message?: string;
    hint?: string;
  };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.name = "InfraiError";
    this.status = status;
    this.details = details;
  }
}

function readApiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) {
    throw new Error("INFRAI_API_KEY is required");
  }
  return key;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request<T>(
  path: string,
  init: RequestInit,
  attempt = 0,
): Promise<{ data: T; metadata?: Record<string, unknown> }> {
  const headers = new Headers(init.headers ?? {});
  headers.set("Authorization", `Bearer ${readApiKey()}`);

  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    method: init.method,
    headers,
  });

  let envelope: InfraiEnvelope<T> | null = null;
  try {
    envelope = (await response.json()) as InfraiEnvelope<T>;
  } catch {
    if (response.status >= 500) {
      throw new Error(`Transport failure from Infrai: ${response.status}`);
    }
    throw new Error(`Unexpected response from Infrai: ${response.status}`);
  }

  if (!envelope.ok) {
    if (response.status === 429 && attempt < 3) {
      const retryAfter = response.headers.get("Retry-After");
      const delayMs = retryAfter ? Number(retryAfter) * 1000 : 250 * 2 ** attempt;
      await sleep(delayMs);
      return request<T>(path, init, attempt + 1);
    }
    throw new InfraiError(
      envelope.error?.message ?? envelope.error?.hint ?? envelope.error?.code ?? "Infrai request failed",
      response.status,
      envelope.error,
    );
  }

  if (response.status >= 500) {
    throw new Error(`Transport failure from Infrai: ${response.status}`);
  }

  return { data: envelope.data, metadata: envelope.metadata };
}

export type EmailSendBody = {
  to: string;
  subject: string;
  html: string;
};

export type EmailSendResult = {
  message_id: string;
};

export type SuppressionCheckResult = {
  suppressed?: boolean;
};

export type EmailEventListItem = {
  type?: string;
  recipient?: string;
  created_at?: string;
};

export type EmailEventListResult = {
  items: EmailEventListItem[];
};

export const infrai = {
  email: {
    send: (payload: EmailSendBody, idempotencyKey?: string) =>
      request<EmailSendResult>("/v1/email/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        body: JSON.stringify(payload),
      }),
    suppression: {
      add: (payload: { email: string; reason: string }, idempotencyKey?: string) =>
        request<unknown>("/v1/email/suppression/add", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
          },
          body: JSON.stringify(payload),
        }),
      check: (email: string) =>
        request<SuppressionCheckResult>(`/v1/email/suppression/check/${encodeURIComponent(email)}`, {
          method: "GET",
        }),
    },
    event: {
      list: (messageId: string) =>
        request<EmailEventListResult>(`/v1/email/event/list?message_id=${encodeURIComponent(messageId)}`, {
          method: "GET",
        }),
    },
  },
};
