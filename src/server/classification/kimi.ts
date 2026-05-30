import type { KimiCategory } from "./types";

type KimiConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
};

type KimiResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

const SYSTEM_PROMPT =
  "你是短信分类器。只判断短信是否属于贷款、还款提醒、逾期、催收相关内容。只输出 JSON。";

function parseKimiCategory(content: string): KimiCategory {
  const parsed = JSON.parse(content) as { category?: unknown };

  if (parsed.category === "loan_collection" || parsed.category === "other") {
    return parsed.category;
  }

  throw new Error("Invalid Kimi category");
}

export async function classifyWithKimi(
  body: string,
  config: KimiConfig
): Promise<KimiCategory> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const fetchImpl = config.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(
      `${config.baseUrl.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            {
              role: "system",
              content: SYSTEM_PROMPT
            },
            {
              role: "user",
              content: `请分类这条短信。只能返回 {"category":"loan_collection"} 或 {"category":"other"}。\n\n短信内容：${body}`
            }
          ],
          response_format: { type: "json_object" },
          max_completion_tokens: 50,
          stream: false
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Kimi request failed with status ${response.status}`);
    }

    const data = (await response.json()) as KimiResponse;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Kimi response did not include message content");
    }

    return parseKimiCategory(content);
  } finally {
    clearTimeout(timeout);
  }
}
