export class HttpError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.payload = payload;
  }
}

type QueryValue = string | number | boolean | null | undefined;

export function buildQueryString(params: Record<string, QueryValue>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  }

  const text = query.toString();
  return text ? `?${text}` : "";
}

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await parseResponse(response);

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error?: unknown }).error)
        : `Request failed with status ${response.status}`;
    throw new HttpError(message, response.status, payload);
  }

  return payload as T;
}

export function getJson<T>(url: string) {
  return requestJson<T>(url);
}

export function postJson<T>(url: string, body?: unknown, init?: RequestInit) {
  return requestJson<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    ...init,
  });
}

export function patchJson<T>(url: string, body?: unknown, init?: RequestInit) {
  return requestJson<T>(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    ...init,
  });
}

export function deleteJson<T>(url: string, init?: RequestInit) {
  return requestJson<T>(url, { method: "DELETE", ...init });
}
