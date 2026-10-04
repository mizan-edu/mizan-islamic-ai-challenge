// Liveness check. Returns a constant body: no environment values, no request data, no logging.
export const dynamic = 'force-static';

export function GET(): Response {
  return Response.json({ status: 'ok' });
}
