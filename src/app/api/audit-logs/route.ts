import { handle } from "@/lib/server/http";
import * as store from "@/lib/server/db";
import { connection } from "next/server";

export async function GET(request: Request) {
  await connection();
  return handle(async () => {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "100", 10);
    const logs = await store.listAuditLogs(limit);
    return { logs };
  });
}
