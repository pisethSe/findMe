import { NextResponse } from "next/server";

import { DEMO_UNIVERSITIES } from "../../../../data/demo.ts";

export function GET(): NextResponse {
  return NextResponse.json(
    {
      data: DEMO_UNIVERSITIES,
      meta: {
        demo: true,
        count: DEMO_UNIVERSITIES.length,
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
}
