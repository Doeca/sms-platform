import type { InboxResponse } from "@/client/api";

type StatsBarProps = {
  stats: InboxResponse["stats"];
};

const items = [
  ["全部", "all"],
  ["未读", "unread"],
  ["验证码", "verification"],
  ["贷款/催收", "loan_collection"],
  ["其他", "other"]
] as const;

export function StatsBar({ stats }: StatsBarProps) {
  return (
    <section className="stats-bar" aria-label="短信统计">
      {items.map(([label, key]) => (
        <div className="stat" key={key}>
          <span className="stat__label">{label}</span>
          <strong className="stat__value">{stats[key]}</strong>
        </div>
      ))}
    </section>
  );
}
