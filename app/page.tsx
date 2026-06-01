import { cookies } from "next/headers";
import { InboxApp } from "@/components/inbox/InboxApp";
import { hasValidAccessCookie } from "@/server/auth";

export default async function HomePage() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");

  return <InboxApp initialAuthenticated={hasValidAccessCookie(cookieHeader)} />;
}
