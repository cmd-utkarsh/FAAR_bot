import type {
  FrontConversation,
  FrontMessage,
  FrontTemplate,
  FrontSendReplyBody,
  FrontSendReplyResponse,
  FrontListResponse,
  FrontStatus,
  RateLimitState,
} from "@/types";

const BASE_URL = "https://api2.frontapp.com";

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.FRONT_API_TOKEN}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function extractRateLimit(res: Response): RateLimitState {
  return {
    remaining: parseInt(res.headers.get("x-ratelimit-remaining") ?? "0", 10),
    reset: parseInt(res.headers.get("x-ratelimit-reset") ?? "0", 10),
    limit: parseInt(res.headers.get("x-ratelimit-limit") ?? "0", 10),
  };
}

async function handleResponse<T>(res: Response): Promise<{ data: T; rateLimit: RateLimitState }> {
  const rateLimit = extractRateLimit(res);
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(
      `Front API error ${res.status}: ${JSON.stringify(errorBody)}`
    );
  }
  if (res.status === 204) {
    return { data: undefined as unknown as T, rateLimit };
  }
  const data = await res.json();
  return { data, rateLimit };
}

export const frontClient = {
  getRateLimitState(): RateLimitState {
    return { remaining: 0, reset: 0, limit: 0 };
  },

  async listConversations(
    params: URLSearchParams | Record<string, string> = {},
    pageUrl?: string
  ): Promise<{
    data: FrontListResponse<FrontConversation>;
    rateLimit: RateLimitState;
  }> {
    const url = pageUrl
      ? (() => {
          if (pageUrl.startsWith("http://") || pageUrl.startsWith("https://")) {
            return new URL(pageUrl);
          }
          return new URL(pageUrl, BASE_URL);
        })()
      : (() => {
          const u = new URL(`${BASE_URL}/conversations`);
          if (params instanceof URLSearchParams) {
            params.forEach((value, key) => {
              u.searchParams.append(key, value);
            });
          } else {
            Object.entries(params).forEach(([key, value]) => {
              u.searchParams.append(key, value);
            });
          }
          return u;
        })();

    const res = await fetch(url.toString(), { headers: headers() });
    return handleResponse<FrontListResponse<FrontConversation>>(res);
  },

  async getConversation(
    conversationId: string
  ): Promise<{ data: FrontConversation; rateLimit: RateLimitState }> {
    const res = await fetch(`${BASE_URL}/conversations/${conversationId}`, {
      headers: headers(),
    });
    return handleResponse<FrontConversation>(res);
  },

  async getMessages(
    conversationId: string
  ): Promise<{ data: FrontListResponse<FrontMessage>; rateLimit: RateLimitState }> {
    const res = await fetch(
      `${BASE_URL}/conversations/${conversationId}/messages`,
      { headers: headers() }
    );
    return handleResponse<FrontListResponse<FrontMessage>>(res);
  },

  async sendReply(
    conversationId: string,
    body: FrontSendReplyBody
  ): Promise<{ data: FrontSendReplyResponse; rateLimit: RateLimitState }> {
    const res = await fetch(
      `${BASE_URL}/conversations/${conversationId}/messages`,
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
      }
    );
    return handleResponse<FrontSendReplyResponse>(res);
  },

  async updateConversationStatus(
    conversationId: string,
    body: { status?: string; status_id?: string }
  ): Promise<{ data: void; rateLimit: RateLimitState }> {
    const res = await fetch(
      `${BASE_URL}/conversations/${conversationId}`,
      {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify(body),
      }
    );
    return handleResponse<void>(res);
  },

  async listMessageTemplates(): Promise<{
    data: FrontListResponse<FrontTemplate>;
    rateLimit: RateLimitState;
  }> {
    const res = await fetch(`${BASE_URL}/message_templates`, {
      headers: headers(),
    });
    return handleResponse<FrontListResponse<FrontTemplate>>(res);
  },

  async getMessageTemplate(
    templateId: string
  ): Promise<{ data: FrontTemplate; rateLimit: RateLimitState }> {
    const res = await fetch(
      `${BASE_URL}/message_templates/${templateId}`,
      { headers: headers() }
    );
    return handleResponse<FrontTemplate>(res);
  },

  async getCompanyStatuses(): Promise<{
    data: FrontListResponse<FrontStatus>;
    rateLimit: RateLimitState;
  }> {
    const res = await fetch(`${BASE_URL}/company/statuses`, {
      headers: headers(),
    });
    return handleResponse<FrontListResponse<FrontStatus>>(res);
  },

  async listInboxes(): Promise<{
    data: FrontListResponse<{ id: string; name: string; is_private: boolean }>;
    rateLimit: RateLimitState;
  }> {
    const res = await fetch(`${BASE_URL}/inboxes`, {
      headers: headers(),
    });
    return handleResponse<
      FrontListResponse<{ id: string; name: string; is_private: boolean }>
    >(res);
  },

  async listInboxConversations(
    inboxId: string,
    params: Record<string, string> = {}
  ): Promise<{
    data: FrontListResponse<FrontConversation>;
    rateLimit: RateLimitState;
  }> {
    const u = new URL(`${BASE_URL}/inboxes/${inboxId}/conversations`);
    Object.entries(params).forEach(([key, value]) => {
      u.searchParams.append(key, value);
    });
    const res = await fetch(u.toString(), { headers: headers() });
    return handleResponse<FrontListResponse<FrontConversation>>(res);
  },

  async getTeammates(): Promise<{
    data: FrontListResponse<{
      id: string;
      email: string;
      first_name: string;
      last_name: string;
      is_admin: boolean;
      is_available: boolean;
    }>;
    rateLimit: RateLimitState;
  }> {
    const res = await fetch(`${BASE_URL}/teammates`, {
      headers: headers(),
    });
    return handleResponse<
      FrontListResponse<{
        id: string;
        email: string;
        first_name: string;
        last_name: string;
        is_admin: boolean;
        is_available: boolean;
      }>
    >(res);
  },
};

export function extractReplyTo(
  message: FrontMessage,
  conversation: FrontConversation
): string[] {
  const fromRecipient = message.recipients?.find((r) => r.role === "from");
  if (fromRecipient?.handle) return [fromRecipient.handle];

  if (message.author?.email) return [message.author.email];

  if (conversation.recipient?.handle) return [conversation.recipient.handle];

  return [];
}
