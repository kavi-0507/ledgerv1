// Client-side API layer for the local Python backend.
// Base URL can be overridden via VITE_API_BASE_URL.

export const API_BASE_URL: string =
  (import.meta as { env?: { VITE_API_BASE_URL?: string } }).env
    ?.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api";

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = {
  ok: false;
  error: { code: string; message: string; fields?: Record<string, string> };
};
export type ApiEnvelope<T> = ApiOk<T> | ApiErr;

export class ApiError extends Error {
  code: string;
  fields?: Record<string, string>;
  status?: number;
  constructor(
    message: string,
    code = "unknown_error",
    fields?: Record<string, string>,
    status?: number,
  ) {
    super(message);
    this.code = code;
    this.fields = fields;
    this.status = status;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
    });
  } catch (err) {
    throw new ApiError(
      `Can't reach the local backend at ${API_BASE_URL}. Is the Python API running?`,
      "network_error",
      undefined,
      0,
    );
  }

  let body: ApiEnvelope<T> | null = null;
  try {
    body = (await res.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiError(
      `Unexpected response from ${path} (status ${res.status}).`,
      "invalid_response",
      undefined,
      res.status,
    );
  }

  if (body && body.ok) return body.data;
  const err = (body as ApiErr | null)?.error;
  throw new ApiError(
    err?.message ?? `Request failed (${res.status}).`,
    err?.code ?? "request_failed",
    err?.fields,
    res.status,
  );
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export function toQuery(params: Record<string, unknown>): string {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    out.set(k, String(v));
  }
  const s = out.toString();
  return s ? `?${s}` : "";
}
