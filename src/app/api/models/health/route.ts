import { NextResponse } from "next/server";
import { multiModelRouter } from "@/lib/server/llm/provider-router";
import { OLLAMA_BASE_URL, OLLAMA_MODEL, AI_PROVIDER, isMock } from "@/lib/server/config";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const customUrl = searchParams.get("url") || undefined;

  const health = await multiModelRouter.checkOllamaHealth(customUrl);

  return NextResponse.json({
    ...health,
    configuredProvider: isMock() ? "mock" : AI_PROVIDER,
    defaultOllamaModel: OLLAMA_MODEL,
    defaultOllamaBaseUrl: OLLAMA_BASE_URL,
    isMockActive: isMock(),
  });
}
