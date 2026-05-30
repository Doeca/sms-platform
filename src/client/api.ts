export type ClientCategory = "verification" | "loan_collection" | "other";
export type ClientReadState = "all" | "unread" | "read";

export type ClientSource = {
  id: string;
  receivedPhoneNumber: string;
  deviceName: string | null;
  simSlot: number | null;
  label: string;
};

export type ClientMessage = {
  id: string;
  sender: string;
  body: string;
  receivedAt: string;
  createdAt: string;
  category: ClientCategory;
  classificationSource: "keyword" | "kimi" | "manual" | "fallback";
  classificationError: string | null;
  isRead: boolean;
  source: ClientSource;
};

export type InboxResponse = {
  messages: ClientMessage[];
  sources: ClientSource[];
  stats: {
    all: number;
    unread: number;
    verification: number;
    loan_collection: number;
    other: number;
  };
};

export type MessageFilters = {
  readState?: ClientReadState;
  category?: ClientCategory;
  sourceId?: string;
};

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new Error("Response was not valid JSON");
  }
}

export async function enterAccessKey(accessKey: string) {
  const response = await fetch("/api/auth/access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessKey })
  });

  return parseJsonOrThrow<{ ok: true }>(response);
}

export async function fetchMessages(filters: MessageFilters = {}) {
  const params = new URLSearchParams();

  if (filters.readState && filters.readState !== "all") {
    params.set("readState", filters.readState);
  }

  if (filters.category) {
    params.set("category", filters.category);
  }

  if (filters.sourceId?.trim()) {
    params.set("sourceId", filters.sourceId);
  }

  const query = params.toString();
  const response = await fetch(`/api/messages${query ? `?${query}` : ""}`);

  return parseJsonOrThrow<InboxResponse>(response);
}

export async function updateMessage(
  id: string,
  patch: { isRead?: boolean; category?: ClientCategory }
) {
  const response = await fetch(`/api/messages/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch)
  });

  return parseJsonOrThrow<{ message: ClientMessage }>(response);
}
