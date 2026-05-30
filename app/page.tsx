import { APP_NAME } from "@/lib/app-info";

export default function HomePage() {
  return (
    <main className="app-shell">
      <h1>{APP_NAME}</h1>
      <p>Private SMS aggregation dashboard</p>
    </main>
  );
}
