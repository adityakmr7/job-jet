import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { corsHeaders } from "./cors";

/** Default cap for JSON request bodies (bytes of UTF-8 text). */
export const DEFAULT_MAX_JSON_BYTES = 256 * 1024;

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

/**
 * Reads and parses a JSON body with a hard size cap. Throws HttpError(413)
 * if too large and HttpError(400) if it isn't valid JSON — callers wrapped
 * in withErrorHandling get those as clean JSON responses.
 */
export async function readJsonBody(req: Request, maxBytes = DEFAULT_MAX_JSON_BYTES): Promise<unknown> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new HttpError(413, `Request body too large (max ${Math.round(maxBytes / 1024)}KB)`);
  }
  const text = await req.text();
  if (new TextEncoder().encode(text).length > maxBytes) {
    throw new HttpError(413, `Request body too large (max ${Math.round(maxBytes / 1024)}KB)`);
  }
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

/**
 * Wraps a route handler so unexpected failures (DB, Blob, PDF rendering…)
 * become a clean `{ error }` JSON 500 with CORS headers and a server-side
 * console.error, instead of an HTML error page the extension can't parse.
 * HttpError instances map to their own status. Next.js-internal control
 * flow errors (redirect, notFound, dynamic-usage bailouts) are rethrown.
 */
export function withErrorHandling<Rest extends unknown[]>(
  label: string,
  handler: (req: Request, ...rest: Rest) => Promise<Response>
): (req: Request, ...rest: Rest) => Promise<Response> {
  return async (req: Request, ...rest: Rest) => {
    try {
      return await handler(req, ...rest);
    } catch (err) {
      unstable_rethrow(err);
      const headers = corsHeaders(req.headers.get("origin"));
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status, headers });
      }
      console.error(`[${label}]`, err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500, headers });
    }
  };
}
