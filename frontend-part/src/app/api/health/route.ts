import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET(): NextResponse {
  return NextResponse.json({
    status: "ok",
    service: "findme-web",
    timestamp: new Date().toISOString(),
  });
}
