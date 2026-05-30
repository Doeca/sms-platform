import type { ClassificationResult } from "./types";

const VERIFICATION_KEYWORDS = [
  "验证码",
  "校验码",
  "动态码",
  "otp",
  "verification code"
];

export function classifyByVerificationKeyword(
  body: string
): ClassificationResult | null {
  const normalized = body.toLowerCase();

  if (VERIFICATION_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return {
      category: "verification",
      source: "keyword"
    };
  }

  return null;
}
