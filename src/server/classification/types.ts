export type MessageCategory = "verification" | "loan_collection" | "other";

export type ClassificationSource = "keyword" | "kimi" | "manual" | "fallback";

export type ClassificationResult = {
  category: MessageCategory;
  source: ClassificationSource;
  error?: string;
};

export type KimiCategory = MessageCategory;
