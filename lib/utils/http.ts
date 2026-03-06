export function jsonError(code: string, message: string, status: number, details?: unknown) {
  return Response.json({ error: { code, message, details } }, { status });
}
