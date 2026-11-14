/** An expected failure that maps directly to an HTTP response. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly headers: Record<string, string> = {},
  ) {
    super(message);
  }
}

/** What a service hands back to a route: enough to replay it later for idempotency. */
export interface ApiResult {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}
