/** Thrown for a non-2xx response. `data` is the parsed body, so a caller can read fields like `sent`. */
export class AdminRequestError extends Error {
  readonly data: Record<string, unknown>;
  readonly status: number;

  constructor(message: string, data: Record<string, unknown>, status: number) {
    super(message);
    this.name = 'AdminRequestError';
    this.data = data;
    this.status = status;
  }
}

export async function adminPost<T = unknown>(url: string, body: unknown = {}, method = 'POST'): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AdminRequestError(
      typeof data.error === 'string' && data.error ? data.error : 'The action failed.',
      data && typeof data === 'object' ? data : {},
      response.status,
    );
  }
  return data as T;
}
