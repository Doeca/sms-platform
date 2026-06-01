import type { ClientCategory, ClientReadState } from "@/client/api";

export type InboxCategoryTab = {
  category: ClientCategory;
  label: string;
  emptyNoun: string;
};

export const inboxCategoryTabs = [
  {
    category: "verification",
    label: "验证码",
    emptyNoun: "验证码短信"
  },
  {
    category: "loan_collection",
    label: "金融",
    emptyNoun: "金融短信"
  },
  {
    category: "other",
    label: "其他",
    emptyNoun: "其他短信"
  }
] as const satisfies readonly InboxCategoryTab[];

export function getCategoryLabel(category: ClientCategory) {
  return (
    inboxCategoryTabs.find((tab) => tab.category === category)?.label ?? "短信"
  );
}

export function getEmptyMessage(
  category: ClientCategory,
  readState: ClientReadState = "all"
) {
  const tab = inboxCategoryTabs.find((item) => item.category === category);
  const noun = tab?.emptyNoun ?? "短信";

  if (readState === "unread") {
    return `没有未读${noun}`;
  }

  if (readState === "read") {
    return `没有已读${noun}`;
  }

  return `没有${noun}`;
}
