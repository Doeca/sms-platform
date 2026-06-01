"use client";

import type { ClientCategory, InboxResponse } from "@/client/api";
import { inboxCategoryTabs } from "./category-config";

type CategoryTabsProps = {
  activeCategory: ClientCategory;
  stats: InboxResponse["stats"];
  onChange: (category: ClientCategory) => void;
};

export function CategoryTabs({
  activeCategory,
  stats,
  onChange
}: CategoryTabsProps) {
  return (
    <nav className="category-tabs" aria-label="短信分类">
      <div className="category-tabs__track">
        {inboxCategoryTabs.map((tab) => {
          const unreadCount = stats.unreadByCategory[tab.category];
          const selected = tab.category === activeCategory;
          const label =
            unreadCount > 0 ? `${tab.label} ${unreadCount}` : tab.label;

          return (
            <button
              aria-current={selected ? "page" : undefined}
              aria-label={label}
              className="category-tab"
              key={tab.category}
              onClick={() => onChange(tab.category)}
              type="button"
            >
              <span>{tab.label}</span>
              {unreadCount > 0 ? (
                <span className="category-tab__badge">{unreadCount}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
