/**
 * The one way the app talks to the ClinicOS API. Set EXPO_PUBLIC_API_URL to the API address:
 * a phone needs the computer's network address, and the Android emulator uses http://10.0.2.2:4000.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/+$/, '');

const TIMEOUT_MS = 20_000;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: { field?: string; issue: string }[] = [],
  ) {
    super(message);
  }

  /** The server's message for one form field, if it sent one. */
  field(name: string) {
    return this.details.find((detail) => detail.field === name)?.issue;
  }
}

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  /** For lists: resolves to { data, meta } instead of the data alone. */
  meta?: boolean;
};

export type Listed<T> = { data: T; meta: { total?: number; unread?: number; nextCursor?: string | null } };

export async function apiRequest<T>(path: string, { method = 'GET', body, token, meta = false }: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      signal: controller.signal,
      // The app signs in with a token; it never sends or keeps cookies.
      credentials: 'omit',
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'OFFLINE', 'We could not reach the clinic service. Check your connection and try again.');
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) return undefined as T;
  const payload = (await response.json().catch(() => null)) as {
    data?: T;
    meta?: Listed<T>['meta'];
    error?: { code: string; message: string; details?: { field?: string; issue: string }[] };
  } | null;
  if (!response.ok || !payload) {
    const error = payload?.error;
    throw new ApiError(response.status, error?.code ?? 'UNKNOWN', error?.message ?? 'Something went wrong. Please try again.', error?.details);
  }
  return (meta ? { data: payload.data, meta: payload.meta ?? {} } : payload.data) as T;
}

export const errorMessage = (error: unknown) =>
  error instanceof ApiError ? (error.details[0]?.issue ?? error.message) : 'Something went wrong. Please try again.';
