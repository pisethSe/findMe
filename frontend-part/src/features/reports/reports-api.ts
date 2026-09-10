import type { ReportReason, ReportReceiptDto } from "@findme/contracts";
import { authorizedRequest } from "../auth/auth-api.ts";

export async function createReport(
  listingId: string,
  input: { reason: ReportReason; details?: string },
): Promise<ReportReceiptDto> {
  const result = await authorizedRequest<unknown>(
    `/listings/${encodeURIComponent(listingId)}/reports`,
    { method: "POST", body: input },
  );
  if (
    typeof result !== "object" ||
    result === null ||
    !("id" in result) ||
    typeof result.id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      result.id,
    ) ||
    !("received" in result) ||
    result.received !== true
  )
    throw new Error("Invalid report receipt.");
  return { id: result.id, received: true };
}
