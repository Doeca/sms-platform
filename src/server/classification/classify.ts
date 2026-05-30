import { classifyByVerificationKeyword } from "./keyword";
import { classifyWithKimi as defaultClassifyWithKimi } from "./kimi";
import type { ClassificationResult, KimiCategory } from "./types";

type ClassifyOptions = {
  classifyWithKimi?: (body: string) => Promise<KimiCategory>;
};

function parseKimiTimeoutMs(value: string | undefined): number {
  const parsed = Number(value ?? "8000");

  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return 8000;
}

function getKimiConfig() {
  return {
    apiKey: process.env.KIMI_API_KEY ?? "",
    baseUrl: process.env.KIMI_BASE_URL ?? "https://api.moonshot.cn/v1",
    model: process.env.KIMI_MODEL ?? "kimi-k2.6",
    timeoutMs: parseKimiTimeoutMs(process.env.KIMI_TIMEOUT_MS)
  };
}

export async function classifyMessage(
  body: string,
  options: ClassifyOptions = {}
): Promise<ClassificationResult> {
  const keywordResult = classifyByVerificationKeyword(body);

  if (keywordResult) {
    return keywordResult;
  }

  try {
    const kimiCategory = options.classifyWithKimi
      ? await options.classifyWithKimi(body)
      : await defaultClassifyWithKimi(body, getKimiConfig());

    return {
      category: kimiCategory,
      source: "kimi"
    };
  } catch (error) {
    return {
      category: "other",
      source: "fallback",
      error:
        error instanceof Error ? error.message : "Unknown classification error"
    };
  }
}
