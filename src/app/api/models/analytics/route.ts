import { handle } from "@/lib/server/http";
import { multiModelRouter } from "@/lib/server/llm/provider-router";

export async function GET() {
  return handle(async () => {
    const analytics = multiModelRouter.getAnalytics();
    return { analytics };
  });
}
