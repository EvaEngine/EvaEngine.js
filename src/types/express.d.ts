/**
 * Runtime request properties attached by EvaEngine middlewares that are not part
 * of the express Request contract:
 * - auth: set by middlewares/auth and middlewares/auth_kong, read by view_cache
 * - uid: custom per-user cache-key rule fallback read by middlewares/view_cache
 * Values are produced by consumer login flows or configs, so the payload shape
 * is intentionally kept open.
 */
declare namespace Express {
  interface Request {
    auth?: Record<string, unknown>;
    uid?: unknown;
  }
}
