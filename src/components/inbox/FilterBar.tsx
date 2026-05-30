"use client";

import type {
  ClientCategory,
  ClientReadState,
  ClientSource,
  MessageFilters
} from "@/client/api";

type FilterBarProps = {
  filters: MessageFilters;
  sources: ClientSource[];
  onChange: (filters: MessageFilters) => void;
};

export function FilterBar({ filters, sources, onChange }: FilterBarProps) {
  return (
    <section className="filter-bar" aria-label="筛选">
      <label>
        已读状态
        <select
          value={filters.readState ?? "all"}
          onChange={(event) =>
            onChange({
              ...filters,
              readState: event.target.value as ClientReadState
            })
          }
        >
          <option value="all">全部</option>
          <option value="unread">未读</option>
          <option value="read">已读</option>
        </select>
      </label>

      <label>
        分类
        <select
          value={filters.category ?? ""}
          onChange={(event) =>
            onChange({
              ...filters,
              category: event.target.value
                ? (event.target.value as ClientCategory)
                : undefined
            })
          }
        >
          <option value="">全部</option>
          <option value="verification">验证码</option>
          <option value="loan_collection">贷款/催收</option>
          <option value="other">其他</option>
        </select>
      </label>

      <label>
        来源
        <select
          value={filters.sourceId ?? ""}
          onChange={(event) =>
            onChange({
              ...filters,
              sourceId: event.target.value || undefined
            })
          }
        >
          <option value="">全部来源</option>
          {sources.map((source) => (
            <option value={source.id} key={source.id}>
              {source.label}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
