import { NextResponse } from "next/server";
import { labEnabled } from "./guard";

/** Every lab route calls this first: the lab does not exist in production. */
export function labGate(): NextResponse | null {
  return labEnabled() ? null : new NextResponse("Not found", { status: 404 });
}
