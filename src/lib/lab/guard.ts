/** The lab is a development tool: every page and API route 404s in production. */
export function labEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}
