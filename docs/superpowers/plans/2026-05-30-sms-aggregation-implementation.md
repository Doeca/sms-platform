# SMS Aggregation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public-VPS deployable SMS aggregation web app that receives Android-forwarded SMS messages, classifies them with keyword rules plus Kimi, stores them in SQLite, and displays them in a protected auto-refreshing inbox.

**Architecture:** Use a single Next.js app-router project. Keep server behavior in focused `src/server/*` modules with unit tests, keep API route handlers thin, and keep browser-only inbox behavior in client components and hooks. Use Prisma with SQLite for persistence and direct `fetch` calls for Kimi's OpenAI-compatible chat completions API.

**Tech Stack:** Node 26, npm 11, Next.js 16.2.6, React 19.2.6, TypeScript, Prisma 7.8.0, SQLite, Vitest 4.1.7, React Testing Library, Zod 4.4.3, lucide-react 1.17.0.

---

## References

- Approved design spec: `docs/superpowers/specs/2026-05-30-sms-aggregation-design.md`
- Kimi API overview: `https://platform.kimi.com/docs/api/overview`
- Kimi chat completions API: `https://platform.kimi.com/docs/api/chat`

Use the China Kimi base URL by default: `https://api.moonshot.cn/v1`. Keep it configurable with `KIMI_BASE_URL`.

## File Structure

All paths are relative to `/Users/doeca/Documents/sms-platform`.

### Project And Tooling

- Create `package.json`: npm scripts and pinned dependencies.
- Create `tsconfig.json`: TypeScript settings for Next.js and tests.
- Create `next.config.ts`: minimal Next config.
- Create `vitest.config.ts`: Vitest config with jsdom for component tests.
- Create `vitest.setup.ts`: test setup and cleanup.
- Modify `.gitignore`: ignore env files, SQLite files, Next output, coverage, and dependencies.
- Create `.env.example`: required configuration keys.

### Database

- Create `prisma/schema.prisma`: Prisma models and enums.
- Create `src/server/db/prisma.ts`: singleton Prisma client.
- Create `src/server/db/test-utils.ts`: database reset helper for integration tests.

### Shared Types And Message Helpers

- Create `src/server/messages/schemas.ts`: Zod schemas for ingest, list filters, and patch payloads.
- Create `src/server/messages/identifiers.ts`: dedupe key builder.
- Create `src/server/messages/format.ts`: source label and API serialization helpers.
- Create `src/server/messages/repository.ts`: Prisma-backed persistence and query functions.

### Authentication

- Create `src/server/auth.ts`: ingest bearer token validation and web access cookie helpers.
- Create `app/api/auth/access/route.ts`: web access-key endpoint.

### Classification

- Create `src/server/classification/types.ts`: category and source types.
- Create `src/server/classification/keyword.ts`: conservative verification keyword detector.
- Create `src/server/classification/kimi.ts`: Kimi API adapter.
- Create `src/server/classification/classify.ts`: orchestration for keyword-first, Kimi-second classification.

### API Routes

- Create `app/api/messages/ingest/route.ts`: Android push endpoint.
- Create `app/api/messages/route.ts`: inbox list endpoint.
- Create `app/api/messages/[id]/route.ts`: message update endpoint.

### Frontend

- Create `app/layout.tsx`: root layout.
- Create `app/page.tsx`: inbox app entry.
- Create `app/globals.css`: app styling.
- Create `src/client/api.ts`: typed browser API functions.
- Create `src/components/access/AccessForm.tsx`: access-key form.
- Create `src/components/inbox/InboxApp.tsx`: authenticated inbox container.
- Create `src/components/inbox/StatsBar.tsx`: summary counts.
- Create `src/components/inbox/FilterBar.tsx`: read/category/source filters.
- Create `src/components/inbox/MessageList.tsx`: message list.
- Create `src/components/inbox/MessageItem.tsx`: per-message actions.
- Create `src/components/inbox/NotificationToggle.tsx`: notification permission control.
- Create `src/hooks/useVerificationNotifications.ts`: browser notification behavior.

### Tests

- Create colocated `*.test.ts` and `*.test.tsx` files for server helpers, classification, repository behavior, route handlers, client API, components, and notification hook.

---

## Task 1: Scaffold Next.js, TypeScript, And Test Tooling

**Files:**

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/globals.css`
- Create: `src/lib/app-info.test.ts`
- Create: `src/lib/app-info.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Create the package manifest**

Create `package.json` with this content:

```json
{
  "name": "sms-platform",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:studio": "prisma studio"
  },
  "dependencies": {
    "@prisma/client": "7.8.0",
    "lucide-react": "1.17.0",
    "next": "16.2.6",
    "react": "19.2.6",
    "react-dom": "19.2.6",
    "zod": "4.4.3"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "6.9.1",
    "@testing-library/react": "16.3.2",
    "@testing-library/user-event": "14.6.1",
    "@types/node": "^24.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "jsdom": "29.1.1",
    "prisma": "7.8.0",
    "typescript": "^5.9.0",
    "vitest": "4.1.7"
  }
}
```

- [ ] **Step 2: Create TypeScript and Next configuration**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "plugins": [
      {
        "name": "next"
      }
    ]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Create `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "app/**/*.test.ts"],
    coverage: {
      reporter: ["text", "html"]
    }
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname
    }
  }
});
```

Create `vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
```

- [ ] **Step 3: Create minimal app files**

Create `app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SMS Inbox",
  description: "Private SMS aggregation inbox"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
```

Create `app/page.tsx`:

```tsx
export default function HomePage() {
  return (
    <main className="app-shell">
      <h1>SMS Inbox</h1>
      <p>Private SMS aggregation dashboard</p>
    </main>
  );
}
```

Create `app/globals.css`:

```css
:root {
  color-scheme: light;
  --bg: #f5f7fb;
  --panel: #ffffff;
  --text: #18202f;
  --muted: #647084;
  --line: #d8dee9;
  --accent: #2563eb;
  --accent-strong: #1d4ed8;
  --success: #047857;
  --warning: #b45309;
  --danger: #b91c1c;
}

* {
  box-sizing: border-box;
}

html,
body {
  min-height: 100%;
  margin: 0;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
}

button,
input,
select {
  font: inherit;
}

.app-shell {
  width: min(1180px, calc(100% - 32px));
  margin: 0 auto;
  padding: 32px 0;
}
```

- [ ] **Step 4: Update `.gitignore`**

Replace `.gitignore` with:

```gitignore
.codegraph/
.env
.env*.local
node_modules/
.next/
coverage/
prisma/*.db
prisma/*.db-journal
prisma/*.db-wal
prisma/*.db-shm
```

- [ ] **Step 5: Install dependencies**

Run:

```bash
npm install
```

Expected: `package-lock.json` is created and npm exits with code 0.

- [ ] **Step 6: Write the failing app-info test**

Create `src/lib/app-info.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { APP_NAME, POLL_INTERVAL_MS } from "./app-info";

describe("app info", () => {
  it("exposes stable application metadata", () => {
    expect(APP_NAME).toBe("SMS Inbox");
    expect(POLL_INTERVAL_MS).toBe(5000);
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run:

```bash
npm test -- src/lib/app-info.test.ts
```

Expected: FAIL with an error that includes `Cannot find module './app-info'`.

- [ ] **Step 8: Implement app info**

Create `src/lib/app-info.ts`:

```ts
export const APP_NAME = "SMS Inbox";
export const POLL_INTERVAL_MS = 5000;
```

- [ ] **Step 9: Run the scaffold verification**

Run:

```bash
npm test -- src/lib/app-info.test.ts
npm run build
```

Expected: the test passes and Next.js build exits with code 0.

- [ ] **Step 10: Commit**

Run:

```bash
git add .gitignore package.json package-lock.json tsconfig.json next.config.ts vitest.config.ts vitest.setup.ts app src/lib
git commit -m "chore: scaffold sms inbox app"
```

---

## Task 2: Add Prisma Schema And Database Helpers

**Files:**

- Create: `prisma/schema.prisma`
- Create: `.env.example`
- Create: `src/server/db/prisma.ts`
- Create: `src/server/db/test-utils.ts`

- [ ] **Step 1: Create the Prisma schema**

Create `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

enum MessageCategory {
  verification
  loan_collection
  other
}

enum ClassificationSource {
  keyword
  kimi
  manual
  fallback
}

model MessageSource {
  id                  String    @id @default(cuid())
  receivedPhoneNumber String
  deviceName          String?
  simSlot             Int?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  messages            Message[]

  @@index([receivedPhoneNumber])
  @@index([deviceName])
}

model Message {
  id                   String               @id @default(cuid())
  sourceId             String
  source               MessageSource        @relation(fields: [sourceId], references: [id], onDelete: Cascade)
  sender               String
  body                 String
  receivedAt           DateTime
  category             MessageCategory
  classificationSource ClassificationSource
  classificationError  String?
  isRead               Boolean              @default(false)
  dedupeKey            String               @unique
  createdAt            DateTime             @default(now())
  updatedAt            DateTime             @updatedAt

  @@index([receivedAt])
  @@index([createdAt])
  @@index([isRead])
  @@index([category])
  @@index([sourceId])
}
```

- [ ] **Step 2: Create environment example**

Create `.env.example`:

```bash
DATABASE_URL="file:./dev.db"
SMS_INGEST_TOKEN="replace-with-long-random-ingest-token"
WEB_ACCESS_KEY="replace-with-long-random-web-access-key"
KIMI_API_KEY="replace-with-moonshot-api-key"
KIMI_BASE_URL="https://api.moonshot.cn/v1"
KIMI_MODEL="kimi-k2.6"
KIMI_TIMEOUT_MS="8000"
```

- [ ] **Step 3: Generate Prisma client and push schema**

Run:

```bash
cp .env.example .env
npm run db:generate
npm run db:push
```

Expected: Prisma generates the client and creates `prisma/dev.db`.

- [ ] **Step 4: Create Prisma singleton**

Create `src/server/db/prisma.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 5: Create database reset helper**

Create `src/server/db/test-utils.ts`:

```ts
import { prisma } from "./prisma";

export async function resetDatabase() {
  await prisma.message.deleteMany();
  await prisma.messageSource.deleteMany();
}
```

- [ ] **Step 6: Verify schema**

Run:

```bash
npm run db:generate
npm run db:push
```

Expected: both commands exit with code 0.

- [ ] **Step 7: Commit**

Run:

```bash
git add .env.example prisma src/server/db package.json package-lock.json .gitignore
git commit -m "feat: add sms database schema"
```

---

## Task 3: Add Message Validation, Dedupe, And Formatting Helpers

**Files:**

- Create: `src/server/messages/schemas.test.ts`
- Create: `src/server/messages/schemas.ts`
- Create: `src/server/messages/identifiers.test.ts`
- Create: `src/server/messages/identifiers.ts`
- Create: `src/server/messages/format.test.ts`
- Create: `src/server/messages/format.ts`

- [ ] **Step 1: Write validation tests**

Create `src/server/messages/schemas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  incomingMessageSchema,
  listMessagesQuerySchema,
  updateMessageSchema
} from "./schemas";

describe("incomingMessageSchema", () => {
  it("accepts the Android forwarding payload", () => {
    const parsed = incomingMessageSchema.parse({
      receivedPhoneNumber: "+8613800000000",
      deviceName: "Redmi 1",
      simSlot: 1,
      sender: "955xx",
      body: "您的验证码是 123456，请勿泄露",
      receivedAt: "2026-05-30T08:30:00.000Z"
    });

    expect(parsed.receivedAt).toEqual(new Date("2026-05-30T08:30:00.000Z"));
    expect(parsed.simSlot).toBe(1);
  });

  it("rejects missing required fields", () => {
    const result = incomingMessageSchema.safeParse({
      receivedPhoneNumber: "+8613800000000",
      body: "missing sender and receivedAt"
    });

    expect(result.success).toBe(false);
  });
});

describe("listMessagesQuerySchema", () => {
  it("defaults the limit to 100", () => {
    const parsed = listMessagesQuerySchema.parse({});
    expect(parsed.limit).toBe(100);
    expect(parsed.readState).toBe("all");
  });
});

describe("updateMessageSchema", () => {
  it("accepts read-state and category updates", () => {
    expect(updateMessageSchema.parse({ isRead: true })).toEqual({ isRead: true });
    expect(updateMessageSchema.parse({ category: "loan_collection" })).toEqual({
      category: "loan_collection"
    });
  });

  it("rejects an empty patch", () => {
    expect(updateMessageSchema.safeParse({}).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run validation tests to verify they fail**

Run:

```bash
npm test -- src/server/messages/schemas.test.ts
```

Expected: FAIL with an error that includes `Cannot find module './schemas'`.

- [ ] **Step 3: Implement validation schemas**

Create `src/server/messages/schemas.ts`:

```ts
import { z } from "zod";

export const messageCategorySchema = z.enum([
  "verification",
  "loan_collection",
  "other"
]);

export const readStateSchema = z.enum(["all", "unread", "read"]);

export const incomingMessageSchema = z.object({
  receivedPhoneNumber: z.string().trim().min(1),
  deviceName: z.string().trim().min(1).optional(),
  simSlot: z.coerce.number().int().min(0).max(8).optional(),
  sender: z.string().trim().min(1),
  body: z.string().trim().min(1),
  receivedAt: z.coerce.date()
});

export const listMessagesQuerySchema = z.object({
  readState: readStateSchema.default("all"),
  category: messageCategorySchema.optional(),
  sourceId: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  before: z.coerce.date().optional()
});

export const updateMessageSchema = z
  .object({
    isRead: z.boolean().optional(),
    category: messageCategorySchema.optional()
  })
  .refine((value) => value.isRead !== undefined || value.category !== undefined, {
    message: "At least one supported field must be provided"
  });

export type IncomingMessageInput = z.infer<typeof incomingMessageSchema>;
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;
export type UpdateMessageInput = z.infer<typeof updateMessageSchema>;
export type MessageCategoryInput = z.infer<typeof messageCategorySchema>;
```

- [ ] **Step 4: Write dedupe tests**

Create `src/server/messages/identifiers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildDedupeKey } from "./identifiers";

describe("buildDedupeKey", () => {
  it("uses receiving number, sender, body, and received time", () => {
    const key = buildDedupeKey({
      receivedPhoneNumber: "+8613800000000",
      sender: "955xx",
      body: "hello",
      receivedAt: new Date("2026-05-30T08:30:00.000Z")
    });

    expect(key).toBe(
      "+8613800000000|955xx|hello|2026-05-30T08:30:00.000Z"
    );
  });
});
```

- [ ] **Step 5: Run dedupe tests to verify they fail**

Run:

```bash
npm test -- src/server/messages/identifiers.test.ts
```

Expected: FAIL with an error that includes `Cannot find module './identifiers'`.

- [ ] **Step 6: Implement dedupe helper**

Create `src/server/messages/identifiers.ts`:

```ts
type DedupeInput = {
  receivedPhoneNumber: string;
  sender: string;
  body: string;
  receivedAt: Date;
};

export function buildDedupeKey(input: DedupeInput) {
  return [
    input.receivedPhoneNumber.trim(),
    input.sender.trim(),
    input.body.trim(),
    input.receivedAt.toISOString()
  ].join("|");
}
```

- [ ] **Step 7: Write formatting tests**

Create `src/server/messages/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatSourceLabel } from "./format";

describe("formatSourceLabel", () => {
  it("prefers device name plus SIM slot", () => {
    expect(
      formatSourceLabel({
        receivedPhoneNumber: "+8613800000000",
        deviceName: "Redmi 1",
        simSlot: 2
      })
    ).toBe("Redmi 1 · SIM 2");
  });

  it("falls back to device name", () => {
    expect(
      formatSourceLabel({
        receivedPhoneNumber: "+8613800000000",
        deviceName: "Redmi 1",
        simSlot: null
      })
    ).toBe("Redmi 1");
  });

  it("falls back to receiving phone number", () => {
    expect(
      formatSourceLabel({
        receivedPhoneNumber: "+8613800000000",
        deviceName: null,
        simSlot: null
      })
    ).toBe("+8613800000000");
  });
});
```

- [ ] **Step 8: Run formatting tests to verify they fail**

Run:

```bash
npm test -- src/server/messages/format.test.ts
```

Expected: FAIL with an error that includes `Cannot find module './format'`.

- [ ] **Step 9: Implement formatting helper**

Create `src/server/messages/format.ts`:

```ts
type SourceLike = {
  receivedPhoneNumber: string;
  deviceName?: string | null;
  simSlot?: number | null;
};

export function formatSourceLabel(source: SourceLike) {
  if (source.deviceName && source.simSlot !== null && source.simSlot !== undefined) {
    return `${source.deviceName} · SIM ${source.simSlot}`;
  }

  if (source.deviceName) {
    return source.deviceName;
  }

  return source.receivedPhoneNumber;
}
```

- [ ] **Step 10: Run helper tests**

Run:

```bash
npm test -- src/server/messages/schemas.test.ts src/server/messages/identifiers.test.ts src/server/messages/format.test.ts
```

Expected: PASS for all helper tests.

- [ ] **Step 11: Commit**

Run:

```bash
git add src/server/messages
git commit -m "feat: add message validation helpers"
```

---

## Task 4: Add Authentication Helpers And Access-Key Route

**Files:**

- Create: `src/server/auth.test.ts`
- Create: `src/server/auth.ts`
- Create: `app/api/auth/access/route.test.ts`
- Create: `app/api/auth/access/route.ts`

- [ ] **Step 1: Write auth helper tests**

Create `src/server/auth.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  ACCESS_COOKIE_NAME,
  buildAccessCookie,
  createAccessCookieValue,
  extractBearerToken,
  hasValidAccessCookie,
  hasValidIngestToken
} from "./auth";

describe("extractBearerToken", () => {
  it("extracts bearer tokens", () => {
    expect(extractBearerToken("Bearer abc123")).toBe("abc123");
  });

  it("rejects non-bearer headers", () => {
    expect(extractBearerToken("Token abc123")).toBeNull();
  });
});

describe("hasValidIngestToken", () => {
  it("validates the configured ingest token", () => {
    expect(hasValidIngestToken("Bearer phone-secret", "phone-secret")).toBe(true);
    expect(hasValidIngestToken("Bearer wrong", "phone-secret")).toBe(false);
  });
});

describe("web access cookie", () => {
  it("creates and validates a signed cookie value", () => {
    const value = createAccessCookieValue("web-secret");
    expect(hasValidAccessCookie(`${ACCESS_COOKIE_NAME}=${value}`, "web-secret")).toBe(
      true
    );
    expect(hasValidAccessCookie(`${ACCESS_COOKIE_NAME}=bad`, "web-secret")).toBe(
      false
    );
  });

  it("builds an httpOnly sameSite cookie", () => {
    const cookie = buildAccessCookie("web-secret", false);
    expect(cookie).toContain(`${ACCESS_COOKIE_NAME}=`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).not.toContain("Secure");
  });
});
```

- [ ] **Step 2: Run auth helper tests to verify they fail**

Run:

```bash
npm test -- src/server/auth.test.ts
```

Expected: FAIL with an error that includes `Cannot find module './auth'`.

- [ ] **Step 3: Implement auth helpers**

Create `src/server/auth.ts`:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

export const ACCESS_COOKIE_NAME = "sms_access";

export function extractBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorizationHeader.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function hasValidIngestToken(
  authorizationHeader: string | null,
  expectedToken = process.env.SMS_INGEST_TOKEN
) {
  const token = extractBearerToken(authorizationHeader);
  return Boolean(token && expectedToken && safeEqual(token, expectedToken));
}

export function createAccessCookieValue(webAccessKey = process.env.WEB_ACCESS_KEY) {
  if (!webAccessKey) {
    throw new Error("WEB_ACCESS_KEY is not configured");
  }

  return createHmac("sha256", webAccessKey)
    .update(`sms-access:${webAccessKey}`)
    .digest("hex");
}

export function hasValidAccessCookie(
  cookieHeader: string | null,
  webAccessKey = process.env.WEB_ACCESS_KEY
) {
  if (!cookieHeader || !webAccessKey) {
    return false;
  }

  const cookies = new Map(
    cookieHeader.split(";").map((part) => {
      const [name, ...valueParts] = part.trim().split("=");
      return [name, valueParts.join("=")];
    })
  );

  const receivedValue = cookies.get(ACCESS_COOKIE_NAME);
  if (!receivedValue) {
    return false;
  }

  return safeEqual(receivedValue, createAccessCookieValue(webAccessKey));
}

export function buildAccessCookie(
  webAccessKey = process.env.WEB_ACCESS_KEY,
  secure = process.env.NODE_ENV === "production"
) {
  const value = createAccessCookieValue(webAccessKey);
  const securePart = secure ? "; Secure" : "";

  return `${ACCESS_COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${securePart}`;
}
```

- [ ] **Step 4: Write access route tests**

Create `app/api/auth/access/route.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { ACCESS_COOKIE_NAME } from "@/server/auth";

describe("POST /api/auth/access", () => {
  it("sets an access cookie for a valid key", async () => {
    vi.stubEnv("WEB_ACCESS_KEY", "web-secret");

    const response = await POST(
      new Request("http://localhost/api/auth/access", {
        method: "POST",
        body: JSON.stringify({ accessKey: "web-secret" })
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(ACCESS_COOKIE_NAME);
  });

  it("rejects invalid keys", async () => {
    vi.stubEnv("WEB_ACCESS_KEY", "web-secret");

    const response = await POST(
      new Request("http://localhost/api/auth/access", {
        method: "POST",
        body: JSON.stringify({ accessKey: "wrong" })
      })
    );

    expect(response.status).toBe(401);
  });
});
```

- [ ] **Step 5: Run access route tests to verify they fail**

Run:

```bash
npm test -- app/api/auth/access/route.test.ts
```

Expected: FAIL with an error that includes `Cannot find module './route'`.

- [ ] **Step 6: Implement access route**

Create `app/api/auth/access/route.ts`:

```ts
import { NextResponse } from "next/server";
import { buildAccessCookie } from "@/server/auth";

type AccessPayload = {
  accessKey?: unknown;
};

export async function POST(request: Request) {
  let payload: AccessPayload;

  try {
    payload = (await request.json()) as AccessPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const expected = process.env.WEB_ACCESS_KEY;

  if (
    typeof payload.accessKey !== "string" ||
    !expected ||
    payload.accessKey !== expected
  ) {
    return NextResponse.json({ error: "Invalid access key" }, { status: 401 });
  }

  return NextResponse.json(
    { ok: true },
    {
      status: 200,
      headers: {
        "Set-Cookie": buildAccessCookie(expected)
      }
    }
  );
}
```

- [ ] **Step 7: Run auth tests**

Run:

```bash
npm test -- src/server/auth.test.ts app/api/auth/access/route.test.ts
```

Expected: PASS for helper and route tests.

- [ ] **Step 8: Commit**

Run:

```bash
git add src/server/auth.ts src/server/auth.test.ts app/api/auth
git commit -m "feat: add access-key authentication"
```

---

## Task 5: Add Keyword-First And Kimi-Backed Classification

**Files:**

- Create: `src/server/classification/types.ts`
- Create: `src/server/classification/keyword.test.ts`
- Create: `src/server/classification/keyword.ts`
- Create: `src/server/classification/kimi.test.ts`
- Create: `src/server/classification/kimi.ts`
- Create: `src/server/classification/classify.test.ts`
- Create: `src/server/classification/classify.ts`

- [ ] **Step 1: Create shared classification types**

Create `src/server/classification/types.ts`:

```ts
export type MessageCategory = "verification" | "loan_collection" | "other";

export type ClassificationSource = "keyword" | "kimi" | "manual" | "fallback";

export type ClassificationResult = {
  category: MessageCategory;
  source: ClassificationSource;
  error?: string;
};

export type KimiCategory = Extract<MessageCategory, "loan_collection" | "other">;
```

- [ ] **Step 2: Write keyword tests**

Create `src/server/classification/keyword.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { classifyByVerificationKeyword } from "./keyword";

describe("classifyByVerificationKeyword", () => {
  it("detects conservative Chinese verification keywords", () => {
    expect(classifyByVerificationKeyword("您的验证码是 123456")).toEqual({
      category: "verification",
      source: "keyword"
    });
    expect(classifyByVerificationKeyword("本次校验码为 9876")).toEqual({
      category: "verification",
      source: "keyword"
    });
  });

  it("detects conservative English verification keywords", () => {
    expect(classifyByVerificationKeyword("Your OTP is 123456")).toEqual({
      category: "verification",
      source: "keyword"
    });
    expect(classifyByVerificationKeyword("verification code: 123456")).toEqual({
      category: "verification",
      source: "keyword"
    });
  });

  it("does not classify bare numbers as verification codes", () => {
    expect(classifyByVerificationKeyword("您的编号是 123456")).toBeNull();
  });
});
```

- [ ] **Step 3: Run keyword tests to verify they fail**

Run:

```bash
npm test -- src/server/classification/keyword.test.ts
```

Expected: FAIL with an error that includes `Cannot find module './keyword'`.

- [ ] **Step 4: Implement keyword classification**

Create `src/server/classification/keyword.ts`:

```ts
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
```

- [ ] **Step 5: Write Kimi adapter tests**

Create `src/server/classification/kimi.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { classifyWithKimi } from "./kimi";

describe("classifyWithKimi", () => {
  it("maps a valid Kimi JSON response", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        choices: [
          {
            message: {
              content: "{\"category\":\"loan_collection\"}"
            }
          }
        ]
      })
    );

    await expect(
      classifyWithKimi("请尽快还款", {
        apiKey: "key",
        baseUrl: "https://api.moonshot.cn/v1",
        model: "kimi-k2.6",
        timeoutMs: 8000,
        fetchImpl
      })
    ).resolves.toBe("loan_collection");

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.moonshot.cn/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer key",
          "Content-Type": "application/json"
        })
      })
    );
  });

  it("throws for invalid response categories", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        choices: [
          {
            message: {
              content: "{\"category\":\"verification\"}"
            }
          }
        ]
      })
    );

    await expect(
      classifyWithKimi("ambiguous text", {
        apiKey: "key",
        baseUrl: "https://api.moonshot.cn/v1",
        model: "kimi-k2.6",
        timeoutMs: 8000,
        fetchImpl
      })
    ).rejects.toThrow("Invalid Kimi category");
  });

  it("throws when Kimi returns a non-2xx response", async () => {
    const fetchImpl = vi.fn(async () => new Response("rate limited", { status: 429 }));

    await expect(
      classifyWithKimi("ambiguous text", {
        apiKey: "key",
        baseUrl: "https://api.moonshot.cn/v1",
        model: "kimi-k2.6",
        timeoutMs: 8000,
        fetchImpl
      })
    ).rejects.toThrow("Kimi request failed with status 429");
  });
});
```

- [ ] **Step 6: Run Kimi adapter tests to verify they fail**

Run:

```bash
npm test -- src/server/classification/kimi.test.ts
```

Expected: FAIL with an error that includes `Cannot find module './kimi'`.

- [ ] **Step 7: Implement Kimi adapter**

Create `src/server/classification/kimi.ts`:

```ts
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
```

- [ ] **Step 8: Write classifier orchestration tests**

Create `src/server/classification/classify.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { classifyMessage } from "./classify";

describe("classifyMessage", () => {
  it("uses keyword classification before Kimi", async () => {
    const classifyWithKimi = vi.fn();

    const result = await classifyMessage("您的验证码是 123456", {
      classifyWithKimi
    });

    expect(result).toEqual({ category: "verification", source: "keyword" });
    expect(classifyWithKimi).not.toHaveBeenCalled();
  });

  it("uses Kimi for non-verification messages", async () => {
    const classifyWithKimi = vi.fn(async () => "loan_collection" as const);

    const result = await classifyMessage("请尽快处理逾期账单", {
      classifyWithKimi
    });

    expect(result).toEqual({ category: "loan_collection", source: "kimi" });
  });

  it("falls back to other when Kimi fails", async () => {
    const classifyWithKimi = vi.fn(async () => {
      throw new Error("network down");
    });

    const result = await classifyMessage("普通通知", {
      classifyWithKimi
    });

    expect(result).toEqual({
      category: "other",
      source: "fallback",
      error: "network down"
    });
  });
});
```

- [ ] **Step 9: Run classifier tests to verify they fail**

Run:

```bash
npm test -- src/server/classification/classify.test.ts
```

Expected: FAIL with an error that includes `Cannot find module './classify'`.

- [ ] **Step 10: Implement classifier orchestration**

Create `src/server/classification/classify.ts`:

```ts
import { classifyByVerificationKeyword } from "./keyword";
import { classifyWithKimi as defaultClassifyWithKimi } from "./kimi";
import type { ClassificationResult, KimiCategory } from "./types";

type ClassifyOptions = {
  classifyWithKimi?: (body: string) => Promise<KimiCategory>;
};

function getKimiConfig() {
  return {
    apiKey: process.env.KIMI_API_KEY ?? "",
    baseUrl: process.env.KIMI_BASE_URL ?? "https://api.moonshot.cn/v1",
    model: process.env.KIMI_MODEL ?? "kimi-k2.6",
    timeoutMs: Number(process.env.KIMI_TIMEOUT_MS ?? "8000")
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
      error: error instanceof Error ? error.message : "Unknown classification error"
    };
  }
}
```

- [ ] **Step 11: Run classification tests**

Run:

```bash
npm test -- src/server/classification
```

Expected: PASS for all classification tests.

- [ ] **Step 12: Commit**

Run:

```bash
git add src/server/classification
git commit -m "feat: add sms classification service"
```

---

## Task 6: Add Prisma Message Repository

**Files:**

- Create: `src/server/messages/repository.test.ts`
- Create: `src/server/messages/repository.ts`

- [ ] **Step 1: Write repository tests**

Create `src/server/messages/repository.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma";
import { resetDatabase } from "@/server/db/test-utils";
import {
  listMessages,
  saveIncomingMessage,
  updateMessage
} from "./repository";

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("message repository", () => {
  it("stores incoming messages as unread and reuses the same source", async () => {
    const first = await saveIncomingMessage(
      {
        receivedPhoneNumber: "+8613800000000",
        deviceName: "Redmi 1",
        simSlot: 1,
        sender: "955xx",
        body: "您的验证码是 123456",
        receivedAt: new Date("2026-05-30T08:30:00.000Z")
      },
      { category: "verification", source: "keyword" }
    );

    const second = await saveIncomingMessage(
      {
        receivedPhoneNumber: "+8613800000000",
        deviceName: "Redmi 1",
        simSlot: 1,
        sender: "10086",
        body: "普通通知",
        receivedAt: new Date("2026-05-30T08:31:00.000Z")
      },
      { category: "other", source: "kimi" }
    );

    expect(first.message.isRead).toBe(false);
    expect(first.duplicate).toBe(false);
    expect(second.message.sourceId).toBe(first.message.sourceId);
  });

  it("returns an existing message for duplicate retry payloads", async () => {
    const input = {
      receivedPhoneNumber: "+8613800000000",
      sender: "955xx",
      body: "您的验证码是 123456",
      receivedAt: new Date("2026-05-30T08:30:00.000Z")
    };

    const first = await saveIncomingMessage(input, {
      category: "verification",
      source: "keyword"
    });
    const duplicate = await saveIncomingMessage(input, {
      category: "verification",
      source: "keyword"
    });

    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.message.id).toBe(first.message.id);
  });

  it("filters messages by read state and category", async () => {
    const saved = await saveIncomingMessage(
      {
        receivedPhoneNumber: "+8613800000000",
        sender: "955xx",
        body: "您的验证码是 123456",
        receivedAt: new Date("2026-05-30T08:30:00.000Z")
      },
      { category: "verification", source: "keyword" }
    );

    await saveIncomingMessage(
      {
        receivedPhoneNumber: "+8613900000000",
        sender: "loan",
        body: "请尽快还款",
        receivedAt: new Date("2026-05-30T08:31:00.000Z")
      },
      { category: "loan_collection", source: "kimi" }
    );

    await updateMessage(saved.message.id, { isRead: true });

    const readVerification = await listMessages({
      readState: "read",
      category: "verification",
      limit: 100
    });

    expect(readVerification.messages).toHaveLength(1);
    expect(readVerification.messages[0].id).toBe(saved.message.id);
    expect(readVerification.stats.unread).toBe(1);
  });

  it("marks manual category edits with manual classification source", async () => {
    const saved = await saveIncomingMessage(
      {
        receivedPhoneNumber: "+8613800000000",
        sender: "loan",
        body: "请尽快还款",
        receivedAt: new Date("2026-05-30T08:31:00.000Z")
      },
      { category: "loan_collection", source: "kimi" }
    );

    const updated = await updateMessage(saved.message.id, {
      category: "other"
    });

    expect(updated.category).toBe("other");
    expect(updated.classificationSource).toBe("manual");
  });
});
```

- [ ] **Step 2: Push the test database and run repository tests to verify they fail**

Run:

```bash
DATABASE_URL="file:./test.db" npm run db:push
DATABASE_URL="file:./test.db" npm test -- src/server/messages/repository.test.ts
```

Expected: the first command succeeds; the test command fails with an error that includes `Cannot find module './repository'`.

- [ ] **Step 3: Implement repository**

Create `src/server/messages/repository.ts`:

```ts
import type { MessageCategory, Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import type { ClassificationResult } from "@/server/classification/types";
import { buildDedupeKey } from "./identifiers";
import type { IncomingMessageInput, ListMessagesQuery, UpdateMessageInput } from "./schemas";

async function findOrCreateSource(input: IncomingMessageInput) {
  const existing = await prisma.messageSource.findFirst({
    where: {
      receivedPhoneNumber: input.receivedPhoneNumber,
      deviceName: input.deviceName ?? null,
      simSlot: input.simSlot ?? null
    }
  });

  if (existing) {
    return existing;
  }

  return prisma.messageSource.create({
    data: {
      receivedPhoneNumber: input.receivedPhoneNumber,
      deviceName: input.deviceName,
      simSlot: input.simSlot
    }
  });
}

function messageInclude() {
  return {
    source: true
  } satisfies Prisma.MessageInclude;
}

export async function saveIncomingMessage(
  input: IncomingMessageInput,
  classification: ClassificationResult
) {
  const dedupeKey = buildDedupeKey(input);
  const existing = await prisma.message.findUnique({
    where: { dedupeKey },
    include: messageInclude()
  });

  if (existing) {
    return {
      duplicate: true,
      message: existing
    };
  }

  const source = await findOrCreateSource(input);
  const message = await prisma.message.create({
    data: {
      sourceId: source.id,
      sender: input.sender,
      body: input.body,
      receivedAt: input.receivedAt,
      category: classification.category,
      classificationSource: classification.source,
      classificationError: classification.error,
      dedupeKey
    },
    include: messageInclude()
  });

  return {
    duplicate: false,
    message
  };
}

export async function listMessages(query: ListMessagesQuery) {
  const where: Prisma.MessageWhereInput = {};

  if (query.readState === "read") {
    where.isRead = true;
  }

  if (query.readState === "unread") {
    where.isRead = false;
  }

  if (query.category) {
    where.category = query.category;
  }

  if (query.sourceId) {
    where.sourceId = query.sourceId;
  }

  if (query.before) {
    where.receivedAt = {
      lt: query.before
    };
  }

  const [messages, sources, all, unread, verification, loanCollection, other] =
    await Promise.all([
      prisma.message.findMany({
        where,
        include: messageInclude(),
        orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
        take: query.limit
      }),
      prisma.messageSource.findMany({
        orderBy: [{ deviceName: "asc" }, { receivedPhoneNumber: "asc" }]
      }),
      prisma.message.count(),
      prisma.message.count({ where: { isRead: false } }),
      prisma.message.count({ where: { category: "verification" } }),
      prisma.message.count({ where: { category: "loan_collection" } }),
      prisma.message.count({ where: { category: "other" } })
    ]);

  return {
    messages,
    sources,
    stats: {
      all,
      unread,
      verification,
      loan_collection: loanCollection,
      other
    }
  };
}

export async function updateMessage(id: string, patch: UpdateMessageInput) {
  const data: Prisma.MessageUpdateInput = {};

  if (patch.isRead !== undefined) {
    data.isRead = patch.isRead;
  }

  if (patch.category !== undefined) {
    data.category = patch.category as MessageCategory;
    data.classificationSource = "manual";
    data.classificationError = null;
  }

  return prisma.message.update({
    where: { id },
    data,
    include: messageInclude()
  });
}
```

- [ ] **Step 4: Run repository tests**

Run:

```bash
DATABASE_URL="file:./test.db" npm test -- src/server/messages/repository.test.ts
```

Expected: PASS for repository tests.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/server/messages/repository.ts src/server/messages/repository.test.ts
git commit -m "feat: add message repository"
```

---

## Task 7: Add Message Ingest API

**Files:**

- Create: `app/api/messages/ingest/route.test.ts`
- Create: `app/api/messages/ingest/route.ts`

- [ ] **Step 1: Write ingest route tests**

Create `app/api/messages/ingest/route.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/db/prisma";
import { resetDatabase } from "@/server/db/test-utils";
import { POST } from "./route";

beforeEach(async () => {
  vi.stubEnv("SMS_INGEST_TOKEN", "phone-secret");
  vi.stubEnv("KIMI_API_KEY", "kimi-secret");
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

function request(body: unknown, token = "phone-secret") {
  return new Request("http://localhost/api/messages/ingest", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

const validPayload = {
  receivedPhoneNumber: "+8613800000000",
  deviceName: "Redmi 1",
  simSlot: 1,
  sender: "955xx",
  body: "您的验证码是 123456",
  receivedAt: "2026-05-30T08:30:00.000Z"
};

describe("POST /api/messages/ingest", () => {
  it("rejects invalid ingest tokens", async () => {
    const response = await POST(request(validPayload, "wrong"));
    expect(response.status).toBe(401);
  });

  it("rejects invalid payloads", async () => {
    const response = await POST(request({ body: "missing required fields" }));
    expect(response.status).toBe(400);
  });

  it("stores valid verification SMS payloads", async () => {
    const response = await POST(request(validPayload));
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.message.category).toBe("verification");
    expect(json.message.isRead).toBe(false);
    expect(json.duplicate).toBe(false);
  });

  it("returns success for duplicate retries", async () => {
    await POST(request(validPayload));
    const response = await POST(request(validPayload));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.duplicate).toBe(true);
  });
});
```

- [ ] **Step 2: Run ingest tests to verify they fail**

Run:

```bash
DATABASE_URL="file:./test.db" npm test -- app/api/messages/ingest/route.test.ts
```

Expected: FAIL with an error that includes `Cannot find module './route'`.

- [ ] **Step 3: Implement ingest route**

Create `app/api/messages/ingest/route.ts`:

```ts
import { NextResponse } from "next/server";
import { hasValidIngestToken } from "@/server/auth";
import { classifyMessage } from "@/server/classification/classify";
import { incomingMessageSchema } from "@/server/messages/schemas";
import { saveIncomingMessage } from "@/server/messages/repository";

export async function POST(request: Request) {
  if (!hasValidIngestToken(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Invalid ingest token" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = incomingMessageSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid ingest payload",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      },
      { status: 400 }
    );
  }

  const classification = await classifyMessage(parsed.data.body);
  const saved = await saveIncomingMessage(parsed.data, classification);

  return NextResponse.json(saved, {
    status: saved.duplicate ? 200 : 201
  });
}
```

- [ ] **Step 4: Run ingest tests**

Run:

```bash
DATABASE_URL="file:./test.db" npm test -- app/api/messages/ingest/route.test.ts
```

Expected: PASS for ingest route tests.

- [ ] **Step 5: Commit**

Run:

```bash
git add app/api/messages/ingest
git commit -m "feat: add sms ingest endpoint"
```

---

## Task 8: Add Inbox List And Update APIs

**Files:**

- Create: `app/api/messages/route.test.ts`
- Create: `app/api/messages/route.ts`
- Create: `app/api/messages/[id]/route.test.ts`
- Create: `app/api/messages/[id]/route.ts`

- [ ] **Step 1: Write list route tests**

Create `app/api/messages/route.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/db/prisma";
import { resetDatabase } from "@/server/db/test-utils";
import { buildAccessCookie } from "@/server/auth";
import { saveIncomingMessage } from "@/server/messages/repository";
import { GET } from "./route";

beforeEach(async () => {
  vi.stubEnv("WEB_ACCESS_KEY", "web-secret");
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

function authedRequest(url = "http://localhost/api/messages") {
  return new Request(url, {
    headers: {
      Cookie: buildAccessCookie("web-secret", false)
    }
  });
}

describe("GET /api/messages", () => {
  it("rejects requests without the access cookie", async () => {
    const response = await GET(new Request("http://localhost/api/messages"));
    expect(response.status).toBe(401);
  });

  it("returns messages, sources, and stats", async () => {
    await saveIncomingMessage(
      {
        receivedPhoneNumber: "+8613800000000",
        sender: "955xx",
        body: "您的验证码是 123456",
        receivedAt: new Date("2026-05-30T08:30:00.000Z")
      },
      { category: "verification", source: "keyword" }
    );

    const response = await GET(authedRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.messages).toHaveLength(1);
    expect(json.sources).toHaveLength(1);
    expect(json.stats.verification).toBe(1);
  });

  it("applies category filters", async () => {
    await saveIncomingMessage(
      {
        receivedPhoneNumber: "+8613800000000",
        sender: "955xx",
        body: "您的验证码是 123456",
        receivedAt: new Date("2026-05-30T08:30:00.000Z")
      },
      { category: "verification", source: "keyword" }
    );

    const response = await GET(
      authedRequest("http://localhost/api/messages?category=other")
    );
    const json = await response.json();

    expect(json.messages).toHaveLength(0);
    expect(json.stats.verification).toBe(1);
  });
});
```

- [ ] **Step 2: Run list route tests to verify they fail**

Run:

```bash
DATABASE_URL="file:./test.db" npm test -- app/api/messages/route.test.ts
```

Expected: FAIL with an error that includes `Cannot find module './route'`.

- [ ] **Step 3: Implement list route**

Create `app/api/messages/route.ts`:

```ts
import { NextResponse } from "next/server";
import { hasValidAccessCookie } from "@/server/auth";
import { listMessagesQuerySchema } from "@/server/messages/schemas";
import { listMessages } from "@/server/messages/repository";
import { formatSourceLabel } from "@/server/messages/format";

function serializeMessage(message: Awaited<ReturnType<typeof listMessages>>["messages"][number]) {
  return {
    id: message.id,
    sender: message.sender,
    body: message.body,
    receivedAt: message.receivedAt.toISOString(),
    createdAt: message.createdAt.toISOString(),
    category: message.category,
    classificationSource: message.classificationSource,
    classificationError: message.classificationError,
    isRead: message.isRead,
    source: {
      id: message.source.id,
      receivedPhoneNumber: message.source.receivedPhoneNumber,
      deviceName: message.source.deviceName,
      simSlot: message.source.simSlot,
      label: formatSourceLabel(message.source)
    }
  };
}

export async function GET(request: Request) {
  if (!hasValidAccessCookie(request.headers.get("cookie"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = listMessagesQuerySchema.safeParse(
    Object.fromEntries(url.searchParams.entries())
  );

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const result = await listMessages(parsed.data);

  return NextResponse.json({
    messages: result.messages.map(serializeMessage),
    sources: result.sources.map((source) => ({
      id: source.id,
      receivedPhoneNumber: source.receivedPhoneNumber,
      deviceName: source.deviceName,
      simSlot: source.simSlot,
      label: formatSourceLabel(source)
    })),
    stats: result.stats
  });
}
```

- [ ] **Step 4: Write update route tests**

Create `app/api/messages/[id]/route.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/db/prisma";
import { resetDatabase } from "@/server/db/test-utils";
import { buildAccessCookie } from "@/server/auth";
import { saveIncomingMessage } from "@/server/messages/repository";
import { PATCH } from "./route";

beforeEach(async () => {
  vi.stubEnv("WEB_ACCESS_KEY", "web-secret");
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

function authedPatch(body: unknown) {
  return new Request("http://localhost/api/messages/message-id", {
    method: "PATCH",
    headers: {
      Cookie: buildAccessCookie("web-secret", false),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

describe("PATCH /api/messages/:id", () => {
  it("rejects requests without the access cookie", async () => {
    const response = await PATCH(new Request("http://localhost/api/messages/1"), {
      params: Promise.resolve({ id: "1" })
    });

    expect(response.status).toBe(401);
  });

  it("marks messages read", async () => {
    const saved = await saveIncomingMessage(
      {
        receivedPhoneNumber: "+8613800000000",
        sender: "955xx",
        body: "您的验证码是 123456",
        receivedAt: new Date("2026-05-30T08:30:00.000Z")
      },
      { category: "verification", source: "keyword" }
    );

    const response = await PATCH(authedPatch({ isRead: true }), {
      params: Promise.resolve({ id: saved.message.id })
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.message.isRead).toBe(true);
  });

  it("manually changes the category", async () => {
    const saved = await saveIncomingMessage(
      {
        receivedPhoneNumber: "+8613800000000",
        sender: "loan",
        body: "请尽快还款",
        receivedAt: new Date("2026-05-30T08:30:00.000Z")
      },
      { category: "loan_collection", source: "kimi" }
    );

    const response = await PATCH(authedPatch({ category: "other" }), {
      params: Promise.resolve({ id: saved.message.id })
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.message.category).toBe("other");
    expect(json.message.classificationSource).toBe("manual");
  });
});
```

- [ ] **Step 5: Run update route tests to verify they fail**

Run:

```bash
DATABASE_URL="file:./test.db" npm test -- app/api/messages/[id]/route.test.ts
```

Expected: FAIL with an error that includes `Cannot find module './route'`.

- [ ] **Step 6: Implement update route**

Create `app/api/messages/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { hasValidAccessCookie } from "@/server/auth";
import { updateMessageSchema } from "@/server/messages/schemas";
import { updateMessage } from "@/server/messages/repository";
import { formatSourceLabel } from "@/server/messages/format";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  if (!hasValidAccessCookie(request.headers.get("cookie"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateMessageSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update payload" }, { status: 400 });
  }

  const { id } = await context.params;
  const message = await updateMessage(id, parsed.data);

  return NextResponse.json({
    message: {
      id: message.id,
      sender: message.sender,
      body: message.body,
      receivedAt: message.receivedAt.toISOString(),
      createdAt: message.createdAt.toISOString(),
      category: message.category,
      classificationSource: message.classificationSource,
      classificationError: message.classificationError,
      isRead: message.isRead,
      source: {
        id: message.source.id,
        receivedPhoneNumber: message.source.receivedPhoneNumber,
        deviceName: message.source.deviceName,
        simSlot: message.source.simSlot,
        label: formatSourceLabel(message.source)
      }
    }
  });
}
```

- [ ] **Step 7: Run inbox API tests**

Run:

```bash
DATABASE_URL="file:./test.db" npm test -- app/api/messages/route.test.ts app/api/messages/[id]/route.test.ts
```

Expected: PASS for list and update route tests.

- [ ] **Step 8: Commit**

Run:

```bash
git add app/api/messages/route.ts app/api/messages/route.test.ts app/api/messages/[id]
git commit -m "feat: add inbox message APIs"
```

---

## Task 9: Add Browser API Client And Access Form

**Files:**

- Create: `src/client/api.test.ts`
- Create: `src/client/api.ts`
- Create: `src/components/access/AccessForm.test.tsx`
- Create: `src/components/access/AccessForm.tsx`

- [ ] **Step 1: Write browser API tests**

Create `src/client/api.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { enterAccessKey, fetchMessages, updateMessage } from "./api";

describe("client api", () => {
  it("submits the access key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ ok: true }))
    );

    await enterAccessKey("secret");

    expect(fetch).toHaveBeenCalledWith("/api/auth/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessKey: "secret" })
    });
  });

  it("fetches messages with filters", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ messages: [], sources: [], stats: {} }))
    );

    await fetchMessages({ readState: "unread", category: "verification" });

    expect(fetch).toHaveBeenCalledWith(
      "/api/messages?readState=unread&category=verification"
    );
  });

  it("patches messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ message: { id: "1" } }))
    );

    await updateMessage("1", { isRead: true });

    expect(fetch).toHaveBeenCalledWith("/api/messages/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isRead: true })
    });
  });
});
```

- [ ] **Step 2: Run browser API tests to verify they fail**

Run:

```bash
npm test -- src/client/api.test.ts
```

Expected: FAIL with an error that includes `Cannot find module './api'`.

- [ ] **Step 3: Implement browser API client**

Create `src/client/api.ts`:

```ts
export type ClientCategory = "verification" | "loan_collection" | "other";
export type ClientReadState = "all" | "unread" | "read";

export type ClientSource = {
  id: string;
  receivedPhoneNumber: string;
  deviceName: string | null;
  simSlot: number | null;
  label: string;
};

export type ClientMessage = {
  id: string;
  sender: string;
  body: string;
  receivedAt: string;
  createdAt: string;
  category: ClientCategory;
  classificationSource: "keyword" | "kimi" | "manual" | "fallback";
  classificationError: string | null;
  isRead: boolean;
  source: ClientSource;
};

export type InboxResponse = {
  messages: ClientMessage[];
  sources: ClientSource[];
  stats: {
    all: number;
    unread: number;
    verification: number;
    loan_collection: number;
    other: number;
  };
};

export type MessageFilters = {
  readState?: ClientReadState;
  category?: ClientCategory;
  sourceId?: string;
};

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function enterAccessKey(accessKey: string) {
  const response = await fetch("/api/auth/access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessKey })
  });

  return parseJsonOrThrow<{ ok: true }>(response);
}

export async function fetchMessages(filters: MessageFilters = {}) {
  const params = new URLSearchParams();

  if (filters.readState && filters.readState !== "all") {
    params.set("readState", filters.readState);
  }

  if (filters.category) {
    params.set("category", filters.category);
  }

  if (filters.sourceId) {
    params.set("sourceId", filters.sourceId);
  }

  const query = params.toString();
  const response = await fetch(`/api/messages${query ? `?${query}` : ""}`);

  return parseJsonOrThrow<InboxResponse>(response);
}

export async function updateMessage(
  id: string,
  patch: { isRead?: boolean; category?: ClientCategory }
) {
  const response = await fetch(`/api/messages/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch)
  });

  return parseJsonOrThrow<{ message: ClientMessage }>(response);
}
```

- [ ] **Step 4: Write access form tests**

Create `src/components/access/AccessForm.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AccessForm } from "./AccessForm";

describe("AccessForm", () => {
  it("submits the typed access key", async () => {
    const onSubmit = vi.fn(async () => undefined);
    const user = userEvent.setup();

    render(<AccessForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("访问密钥"), "secret");
    await user.click(screen.getByRole("button", { name: "进入" }));

    expect(onSubmit).toHaveBeenCalledWith("secret");
  });

  it("shows an error message", () => {
    render(<AccessForm onSubmit={async () => undefined} error="密钥不正确" />);
    expect(screen.getByText("密钥不正确")).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run access form tests to verify they fail**

Run:

```bash
npm test -- src/components/access/AccessForm.test.tsx
```

Expected: FAIL with an error that includes `Cannot find module './AccessForm'`.

- [ ] **Step 6: Implement access form**

Create `src/components/access/AccessForm.tsx`:

```tsx
"use client";

import { FormEvent, useState } from "react";
import { KeyRound } from "lucide-react";

type AccessFormProps = {
  error?: string | null;
  pending?: boolean;
  onSubmit: (accessKey: string) => Promise<void>;
};

export function AccessForm({ error, pending = false, onSubmit }: AccessFormProps) {
  const [accessKey, setAccessKey] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(accessKey);
  }

  return (
    <main className="access-screen">
      <form className="access-form" onSubmit={handleSubmit}>
        <div className="access-form__icon" aria-hidden="true">
          <KeyRound size={24} />
        </div>
        <h1>SMS Inbox</h1>
        <label htmlFor="access-key">访问密钥</label>
        <input
          id="access-key"
          type="password"
          value={accessKey}
          onChange={(event) => setAccessKey(event.target.value)}
          autoComplete="current-password"
          required
        />
        {error ? <p className="form-error">{error}</p> : null}
        <button type="submit" disabled={pending}>
          {pending ? "验证中" : "进入"}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 7: Run access tests**

Run:

```bash
npm test -- src/client/api.test.ts src/components/access/AccessForm.test.tsx
```

Expected: PASS for browser API and access form tests.

- [ ] **Step 8: Commit**

Run:

```bash
git add src/client src/components/access
git commit -m "feat: add web access form"
```

---

## Task 10: Add Inbox UI, Filters, And Per-Message Actions

**Files:**

- Create: `src/components/inbox/StatsBar.test.tsx`
- Create: `src/components/inbox/StatsBar.tsx`
- Create: `src/components/inbox/FilterBar.test.tsx`
- Create: `src/components/inbox/FilterBar.tsx`
- Create: `src/components/inbox/MessageItem.test.tsx`
- Create: `src/components/inbox/MessageItem.tsx`
- Create: `src/components/inbox/MessageList.tsx`
- Create: `src/components/inbox/InboxApp.test.tsx`
- Create: `src/components/inbox/InboxApp.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Write StatsBar test**

Create `src/components/inbox/StatsBar.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatsBar } from "./StatsBar";

describe("StatsBar", () => {
  it("renders all inbox counts", () => {
    render(
      <StatsBar
        stats={{
          all: 10,
          unread: 3,
          verification: 2,
          loan_collection: 4,
          other: 4
        }}
      />
    );

    expect(screen.getByText("全部")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("未读")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("验证码")).toBeInTheDocument();
    expect(screen.getByText("贷款/催收")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run StatsBar test to verify it fails**

Run:

```bash
npm test -- src/components/inbox/StatsBar.test.tsx
```

Expected: FAIL with an error that includes `Cannot find module './StatsBar'`.

- [ ] **Step 3: Implement StatsBar**

Create `src/components/inbox/StatsBar.tsx`:

```tsx
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
```

- [ ] **Step 4: Write FilterBar test**

Create `src/components/inbox/FilterBar.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FilterBar } from "./FilterBar";

describe("FilterBar", () => {
  it("updates read state, category, and source filters", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <FilterBar
        filters={{ readState: "all" }}
        sources={[
          {
            id: "source-1",
            receivedPhoneNumber: "+8613800000000",
            deviceName: "Redmi 1",
            simSlot: 1,
            label: "Redmi 1 · SIM 1"
          }
        ]}
        onChange={onChange}
      />
    );

    await user.selectOptions(screen.getByLabelText("已读状态"), "unread");
    await user.selectOptions(screen.getByLabelText("分类"), "verification");
    await user.selectOptions(screen.getByLabelText("来源"), "source-1");

    expect(onChange).toHaveBeenCalledWith({ readState: "unread" });
    expect(onChange).toHaveBeenCalledWith({
      readState: "all",
      category: "verification"
    });
    expect(onChange).toHaveBeenCalledWith({
      readState: "all",
      sourceId: "source-1"
    });
  });
});
```

- [ ] **Step 5: Run FilterBar test to verify it fails**

Run:

```bash
npm test -- src/components/inbox/FilterBar.test.tsx
```

Expected: FAIL with an error that includes `Cannot find module './FilterBar'`.

- [ ] **Step 6: Implement FilterBar**

Create `src/components/inbox/FilterBar.tsx`:

```tsx
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
```

- [ ] **Step 7: Write MessageItem test**

Create `src/components/inbox/MessageItem.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MessageItem } from "./MessageItem";
import type { ClientMessage } from "@/client/api";

const message: ClientMessage = {
  id: "msg-1",
  sender: "955xx",
  body: "您的验证码是 123456",
  receivedAt: "2026-05-30T08:30:00.000Z",
  createdAt: "2026-05-30T08:30:01.000Z",
  category: "verification",
  classificationSource: "keyword",
  classificationError: null,
  isRead: false,
  source: {
    id: "source-1",
    receivedPhoneNumber: "+8613800000000",
    deviceName: "Redmi 1",
    simSlot: 1,
    label: "Redmi 1 · SIM 1"
  }
};

describe("MessageItem", () => {
  it("renders message content and source", () => {
    render(
      <MessageItem
        message={message}
        onReadToggle={async () => undefined}
        onCategoryChange={async () => undefined}
      />
    );

    expect(screen.getByText("955xx")).toBeInTheDocument();
    expect(screen.getByText("Redmi 1 · SIM 1")).toBeInTheDocument();
    expect(screen.getByText("您的验证码是 123456")).toBeInTheDocument();
  });

  it("toggles read state and category", async () => {
    const onReadToggle = vi.fn(async () => undefined);
    const onCategoryChange = vi.fn(async () => undefined);
    const user = userEvent.setup();

    render(
      <MessageItem
        message={message}
        onReadToggle={onReadToggle}
        onCategoryChange={onCategoryChange}
      />
    );

    await user.click(screen.getByRole("button", { name: "标记已读" }));
    await user.selectOptions(screen.getByLabelText("修改分类"), "other");

    expect(onReadToggle).toHaveBeenCalledWith("msg-1", true);
    expect(onCategoryChange).toHaveBeenCalledWith("msg-1", "other");
  });
});
```

- [ ] **Step 8: Run MessageItem test to verify it fails**

Run:

```bash
npm test -- src/components/inbox/MessageItem.test.tsx
```

Expected: FAIL with an error that includes `Cannot find module './MessageItem'`.

- [ ] **Step 9: Implement MessageItem and MessageList**

Create `src/components/inbox/MessageItem.tsx`:

```tsx
"use client";

import { Mail, MailOpen } from "lucide-react";
import type { ClientCategory, ClientMessage } from "@/client/api";

type MessageItemProps = {
  message: ClientMessage;
  onReadToggle: (id: string, isRead: boolean) => Promise<void>;
  onCategoryChange: (id: string, category: ClientCategory) => Promise<void>;
};

const categoryLabels: Record<ClientCategory, string> = {
  verification: "验证码",
  loan_collection: "贷款/催收",
  other: "其他"
};

export function MessageItem({
  message,
  onReadToggle,
  onCategoryChange
}: MessageItemProps) {
  return (
    <article className={`message-item ${message.isRead ? "is-read" : "is-unread"}`}>
      <header className="message-item__header">
        <span className={`category category--${message.category}`}>
          {categoryLabels[message.category]}
        </span>
        <strong>{message.sender}</strong>
        <span>{message.source.label}</span>
        <time dateTime={message.receivedAt}>
          {new Date(message.receivedAt).toLocaleString("zh-CN")}
        </time>
      </header>

      <p className="message-item__body">{message.body}</p>

      <footer className="message-item__actions">
        <button
          type="button"
          onClick={() => onReadToggle(message.id, !message.isRead)}
        >
          {message.isRead ? <Mail size={16} /> : <MailOpen size={16} />}
          {message.isRead ? "标记未读" : "标记已读"}
        </button>

        <label>
          修改分类
          <select
            value={message.category}
            onChange={(event) =>
              onCategoryChange(message.id, event.target.value as ClientCategory)
            }
          >
            <option value="verification">验证码</option>
            <option value="loan_collection">贷款/催收</option>
            <option value="other">其他</option>
          </select>
        </label>
      </footer>
    </article>
  );
}
```

Create `src/components/inbox/MessageList.tsx`:

```tsx
"use client";

import type { ClientCategory, ClientMessage } from "@/client/api";
import { MessageItem } from "./MessageItem";

type MessageListProps = {
  messages: ClientMessage[];
  onReadToggle: (id: string, isRead: boolean) => Promise<void>;
  onCategoryChange: (id: string, category: ClientCategory) => Promise<void>;
};

export function MessageList({
  messages,
  onReadToggle,
  onCategoryChange
}: MessageListProps) {
  if (messages.length === 0) {
    return <p className="empty-state">没有匹配的短信</p>;
  }

  return (
    <section className="message-list" aria-label="短信列表">
      {messages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          onReadToggle={onReadToggle}
          onCategoryChange={onCategoryChange}
        />
      ))}
    </section>
  );
}
```

- [ ] **Step 10: Write InboxApp test**

Create `src/components/inbox/InboxApp.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InboxApp } from "./InboxApp";

const inboxPayload = {
  messages: [
    {
      id: "msg-1",
      sender: "955xx",
      body: "您的验证码是 123456",
      receivedAt: "2026-05-30T08:30:00.000Z",
      createdAt: "2026-05-30T08:30:01.000Z",
      category: "verification",
      classificationSource: "keyword",
      classificationError: null,
      isRead: false,
      source: {
        id: "source-1",
        receivedPhoneNumber: "+8613800000000",
        deviceName: "Redmi 1",
        simSlot: 1,
        label: "Redmi 1 · SIM 1"
      }
    }
  ],
  sources: [
    {
      id: "source-1",
      receivedPhoneNumber: "+8613800000000",
      deviceName: "Redmi 1",
      simSlot: 1,
      label: "Redmi 1 · SIM 1"
    }
  ],
  stats: {
    all: 1,
    unread: 1,
    verification: 1,
    loan_collection: 0,
    other: 0
  }
};

describe("InboxApp", () => {
  it("loads and displays messages after access succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/auth/access") {
          return Response.json({ ok: true });
        }

        return Response.json(inboxPayload);
      })
    );

    const user = userEvent.setup();

    render(<InboxApp />);

    await user.type(screen.getByLabelText("访问密钥"), "secret");
    await user.click(screen.getByRole("button", { name: "进入" }));

    await waitFor(() => {
      expect(screen.getByText("您的验证码是 123456")).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 11: Run InboxApp test to verify it fails**

Run:

```bash
npm test -- src/components/inbox/InboxApp.test.tsx
```

Expected: FAIL with an error that includes `Cannot find module './InboxApp'`.

- [ ] **Step 12: Implement InboxApp and page entry**

Create `src/components/inbox/InboxApp.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  enterAccessKey,
  fetchMessages,
  updateMessage,
  type ClientCategory,
  type InboxResponse,
  type MessageFilters
} from "@/client/api";
import { POLL_INTERVAL_MS } from "@/lib/app-info";
import { AccessForm } from "@/components/access/AccessForm";
import { FilterBar } from "./FilterBar";
import { MessageList } from "./MessageList";
import { StatsBar } from "./StatsBar";

const emptyInbox: InboxResponse = {
  messages: [],
  sources: [],
  stats: {
    all: 0,
    unread: 0,
    verification: 0,
    loan_collection: 0,
    other: 0
  }
};

export function InboxApp() {
  const [authenticated, setAuthenticated] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [pendingAccess, setPendingAccess] = useState(false);
  const [filters, setFilters] = useState<MessageFilters>({ readState: "all" });
  const [inbox, setInbox] = useState<InboxResponse>(emptyInbox);

  const loadMessages = useCallback(async () => {
    const nextInbox = await fetchMessages(filters);
    setInbox(nextInbox);
  }, [filters]);

  async function handleAccessSubmit(accessKey: string) {
    setPendingAccess(true);
    setAccessError(null);

    try {
      await enterAccessKey(accessKey);
      setAuthenticated(true);
      await loadMessages();
    } catch {
      setAccessError("访问密钥不正确");
    } finally {
      setPendingAccess(false);
    }
  }

  async function handleReadToggle(id: string, isRead: boolean) {
    await updateMessage(id, { isRead });
    await loadMessages();
  }

  async function handleCategoryChange(id: string, category: ClientCategory) {
    await updateMessage(id, { category });
    await loadMessages();
  }

  useEffect(() => {
    if (!authenticated) {
      return;
    }

    void loadMessages();
    const interval = window.setInterval(() => {
      void loadMessages();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [authenticated, loadMessages]);

  if (!authenticated) {
    return (
      <AccessForm
        onSubmit={handleAccessSubmit}
        error={accessError}
        pending={pendingAccess}
      />
    );
  }

  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <h1>SMS Inbox</h1>
          <p>短信聚合收件箱</p>
        </div>
      </header>

      <StatsBar stats={inbox.stats} />
      <FilterBar filters={filters} sources={inbox.sources} onChange={setFilters} />
      <MessageList
        messages={inbox.messages}
        onReadToggle={handleReadToggle}
        onCategoryChange={handleCategoryChange}
      />
    </main>
  );
}
```

Replace `app/page.tsx` with:

```tsx
import { InboxApp } from "@/components/inbox/InboxApp";

export default function HomePage() {
  return <InboxApp />;
}
```

- [ ] **Step 13: Add complete UI styling**

Append this content to `app/globals.css`:

```css
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.page-header h1,
.access-form h1 {
  margin: 0;
  font-size: 28px;
}

.page-header p {
  margin: 4px 0 0;
  color: var(--muted);
}

.access-screen {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
}

.access-form {
  width: min(420px, 100%);
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 28px;
  display: grid;
  gap: 14px;
  box-shadow: 0 20px 45px rgba(24, 32, 47, 0.08);
}

.access-form__icon {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  color: var(--accent);
  background: #e8f0ff;
}

.access-form label,
.filter-bar label,
.message-item__actions label {
  display: grid;
  gap: 6px;
  color: var(--muted);
  font-size: 13px;
}

.access-form input,
.filter-bar select,
.message-item__actions select {
  min-height: 40px;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 0 10px;
  background: #fff;
  color: var(--text);
}

.access-form button,
.message-item__actions button,
.notification-toggle {
  min-height: 40px;
  border: 0;
  border-radius: 6px;
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
}

.access-form button:hover,
.message-item__actions button:hover,
.notification-toggle:hover {
  background: var(--accent-strong);
}

.form-error {
  margin: 0;
  color: var(--danger);
  font-size: 14px;
}

.stats-bar {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.stat {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 14px;
}

.stat__label {
  display: block;
  color: var(--muted);
  font-size: 13px;
}

.stat__value {
  display: block;
  margin-top: 6px;
  font-size: 24px;
}

.filter-bar {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 14px;
}

.message-list {
  display: grid;
  gap: 12px;
}

.message-item {
  background: var(--panel);
  border: 1px solid var(--line);
  border-left: 4px solid var(--line);
  border-radius: 8px;
  padding: 16px;
}

.message-item.is-unread {
  border-left-color: var(--accent);
}

.message-item__header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  color: var(--muted);
  font-size: 14px;
}

.message-item__header strong {
  color: var(--text);
}

.message-item__body {
  margin: 14px 0;
  line-height: 1.65;
  white-space: pre-wrap;
}

.message-item__actions {
  display: flex;
  align-items: end;
  flex-wrap: wrap;
  gap: 12px;
}

.category {
  border-radius: 999px;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 700;
}

.category--verification {
  color: #1d4ed8;
  background: #dbeafe;
}

.category--loan_collection {
  color: #92400e;
  background: #fef3c7;
}

.category--other {
  color: #374151;
  background: #e5e7eb;
}

.empty-state {
  background: var(--panel);
  border: 1px dashed var(--line);
  border-radius: 8px;
  margin: 0;
  padding: 32px;
  text-align: center;
  color: var(--muted);
}

@media (max-width: 760px) {
  .stats-bar,
  .filter-bar {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 14: Run inbox UI tests**

Run:

```bash
npm test -- src/components/inbox
```

Expected: PASS for all inbox component tests.

- [ ] **Step 15: Commit**

Run:

```bash
git add app src/components/inbox
git commit -m "feat: add sms inbox interface"
```

---

## Task 11: Add Verification-Only Browser Notifications

**Files:**

- Create: `src/hooks/useVerificationNotifications.test.tsx`
- Create: `src/hooks/useVerificationNotifications.ts`
- Create: `src/components/inbox/NotificationToggle.test.tsx`
- Create: `src/components/inbox/NotificationToggle.tsx`
- Modify: `src/components/inbox/InboxApp.tsx`

- [ ] **Step 1: Write notification hook tests**

Create `src/hooks/useVerificationNotifications.test.tsx`:

```tsx
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useVerificationNotifications } from "./useVerificationNotifications";
import type { ClientMessage } from "@/client/api";

function message(id: string, category: ClientMessage["category"]): ClientMessage {
  return {
    id,
    sender: "955xx",
    body: "您的验证码是 123456",
    receivedAt: "2026-05-30T08:30:00.000Z",
    createdAt: "2026-05-30T08:30:01.000Z",
    category,
    classificationSource: "keyword",
    classificationError: null,
    isRead: false,
    source: {
      id: "source-1",
      receivedPhoneNumber: "+8613800000000",
      deviceName: "Redmi 1",
      simSlot: 1,
      label: "Redmi 1 · SIM 1"
    }
  };
}

describe("useVerificationNotifications", () => {
  it("does not notify for initial messages", () => {
    const notification = vi.fn();
    vi.stubGlobal("Notification", notification);
    Object.assign(Notification, { permission: "granted" });

    renderHook(({ messages }) => useVerificationNotifications(messages, true), {
      initialProps: { messages: [message("1", "verification")] }
    });

    expect(notification).not.toHaveBeenCalled();
  });

  it("notifies only for newly observed verification messages", () => {
    const notification = vi.fn();
    vi.stubGlobal("Notification", notification);
    Object.assign(Notification, { permission: "granted" });

    const { rerender } = renderHook(
      ({ messages }) => useVerificationNotifications(messages, true),
      {
        initialProps: { messages: [message("1", "other")] }
      }
    );

    rerender({ messages: [message("2", "verification"), message("1", "other")] });

    expect(notification).toHaveBeenCalledTimes(1);
    expect(notification).toHaveBeenCalledWith(
      "收到验证码短信",
      expect.objectContaining({
        body: "955xx · Redmi 1 · SIM 1"
      })
    );
  });
});
```

- [ ] **Step 2: Run notification hook tests to verify they fail**

Run:

```bash
npm test -- src/hooks/useVerificationNotifications.test.tsx
```

Expected: FAIL with an error that includes `Cannot find module './useVerificationNotifications'`.

- [ ] **Step 3: Implement notification hook**

Create `src/hooks/useVerificationNotifications.ts`:

```ts
"use client";

import { useEffect, useRef } from "react";
import type { ClientMessage } from "@/client/api";

export function useVerificationNotifications(
  messages: ClientMessage[],
  enabled: boolean
) {
  const seenIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!enabled || typeof Notification === "undefined") {
      return;
    }

    if (Notification.permission !== "granted") {
      return;
    }

    if (seenIds.current === null) {
      seenIds.current = new Set(messages.map((message) => message.id));
      return;
    }

    for (const message of messages) {
      if (seenIds.current.has(message.id)) {
        continue;
      }

      seenIds.current.add(message.id);

      if (message.category === "verification") {
        new Notification("收到验证码短信", {
          body: `${message.sender} · ${message.source.label}`
        });
      }
    }
  }, [enabled, messages]);
}
```

- [ ] **Step 4: Write notification toggle tests**

Create `src/components/inbox/NotificationToggle.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NotificationToggle } from "./NotificationToggle";

describe("NotificationToggle", () => {
  it("requests browser notification permission", async () => {
    const requestPermission = vi.fn(async () => "granted");
    vi.stubGlobal("Notification", {
      permission: "default",
      requestPermission
    });

    const onEnabledChange = vi.fn();
    const user = userEvent.setup();

    render(<NotificationToggle enabled={false} onEnabledChange={onEnabledChange} />);

    await user.click(screen.getByRole("button", { name: "开启验证码通知" }));

    await waitFor(() => {
      expect(requestPermission).toHaveBeenCalled();
      expect(onEnabledChange).toHaveBeenCalledWith(true);
    });
  });
});
```

- [ ] **Step 5: Run notification toggle tests to verify they fail**

Run:

```bash
npm test -- src/components/inbox/NotificationToggle.test.tsx
```

Expected: FAIL with an error that includes `Cannot find module './NotificationToggle'`.

- [ ] **Step 6: Implement notification toggle**

Create `src/components/inbox/NotificationToggle.tsx`:

```tsx
"use client";

import { Bell, BellOff } from "lucide-react";

type NotificationToggleProps = {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
};

export function NotificationToggle({
  enabled,
  onEnabledChange
}: NotificationToggleProps) {
  async function handleClick() {
    if (enabled) {
      onEnabledChange(false);
      return;
    }

    if (typeof Notification === "undefined") {
      onEnabledChange(false);
      return;
    }

    const permission =
      Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();

    onEnabledChange(permission === "granted");
  }

  return (
    <button className="notification-toggle" type="button" onClick={handleClick}>
      {enabled ? <BellOff size={16} /> : <Bell size={16} />}
      {enabled ? "关闭验证码通知" : "开启验证码通知"}
    </button>
  );
}
```

- [ ] **Step 7: Wire notifications into InboxApp**

Modify `src/components/inbox/InboxApp.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  enterAccessKey,
  fetchMessages,
  updateMessage,
  type ClientCategory,
  type InboxResponse,
  type MessageFilters
} from "@/client/api";
import { POLL_INTERVAL_MS } from "@/lib/app-info";
import { AccessForm } from "@/components/access/AccessForm";
import { useVerificationNotifications } from "@/hooks/useVerificationNotifications";
import { FilterBar } from "./FilterBar";
import { MessageList } from "./MessageList";
import { NotificationToggle } from "./NotificationToggle";
import { StatsBar } from "./StatsBar";

const emptyInbox: InboxResponse = {
  messages: [],
  sources: [],
  stats: {
    all: 0,
    unread: 0,
    verification: 0,
    loan_collection: 0,
    other: 0
  }
};

export function InboxApp() {
  const [authenticated, setAuthenticated] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [pendingAccess, setPendingAccess] = useState(false);
  const [filters, setFilters] = useState<MessageFilters>({ readState: "all" });
  const [inbox, setInbox] = useState<InboxResponse>(emptyInbox);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useVerificationNotifications(inbox.messages, notificationsEnabled);

  const loadMessages = useCallback(async () => {
    const nextInbox = await fetchMessages(filters);
    setInbox(nextInbox);
  }, [filters]);

  async function handleAccessSubmit(accessKey: string) {
    setPendingAccess(true);
    setAccessError(null);

    try {
      await enterAccessKey(accessKey);
      setAuthenticated(true);
      await loadMessages();
    } catch {
      setAccessError("访问密钥不正确");
    } finally {
      setPendingAccess(false);
    }
  }

  async function handleReadToggle(id: string, isRead: boolean) {
    await updateMessage(id, { isRead });
    await loadMessages();
  }

  async function handleCategoryChange(id: string, category: ClientCategory) {
    await updateMessage(id, { category });
    await loadMessages();
  }

  useEffect(() => {
    if (!authenticated) {
      return;
    }

    void loadMessages();
    const interval = window.setInterval(() => {
      void loadMessages();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [authenticated, loadMessages]);

  if (!authenticated) {
    return (
      <AccessForm
        onSubmit={handleAccessSubmit}
        error={accessError}
        pending={pendingAccess}
      />
    );
  }

  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <h1>SMS Inbox</h1>
          <p>短信聚合收件箱</p>
        </div>
        <NotificationToggle
          enabled={notificationsEnabled}
          onEnabledChange={setNotificationsEnabled}
        />
      </header>

      <StatsBar stats={inbox.stats} />
      <FilterBar filters={filters} sources={inbox.sources} onChange={setFilters} />
      <MessageList
        messages={inbox.messages}
        onReadToggle={handleReadToggle}
        onCategoryChange={handleCategoryChange}
      />
    </main>
  );
}
```

- [ ] **Step 8: Run notification tests**

Run:

```bash
npm test -- src/hooks/useVerificationNotifications.test.tsx src/components/inbox/NotificationToggle.test.tsx src/components/inbox/InboxApp.test.tsx
```

Expected: PASS for notification hook, toggle, and inbox tests.

- [ ] **Step 9: Commit**

Run:

```bash
git add src/hooks src/components/inbox
git commit -m "feat: add verification sms notifications"
```

---

## Task 12: Add End-To-End Verification Docs And Run Final Checks

**Files:**

- Create: `README.md`

- [ ] **Step 1: Create README**

Create `README.md`:

```md
# SMS Platform

Private SMS aggregation inbox for Android SMS forwarding clients.

## Environment

Create `.env` from `.env.example` and set:

- `DATABASE_URL`: SQLite database URL, for example `file:./dev.db`
- `SMS_INGEST_TOKEN`: bearer token used by Android forwarding clients
- `WEB_ACCESS_KEY`: access key used to open the web inbox
- `KIMI_API_KEY`: Moonshot/Kimi API key
- `KIMI_BASE_URL`: Kimi base URL, default `https://api.moonshot.cn/v1`
- `KIMI_MODEL`: Kimi model, default `kimi-k2.6`
- `KIMI_TIMEOUT_MS`: classification timeout in milliseconds

## Development

```bash
npm install
cp .env.example .env
npm run db:generate
npm run db:push
npm run dev
```

Open `http://localhost:3000`.

## Test

```bash
npm test
npm run build
```

## Ingest Example

```bash
curl -X POST "http://localhost:3000/api/messages/ingest" \
  -H "Authorization: Bearer $SMS_INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "receivedPhoneNumber": "+8613800000000",
    "deviceName": "Redmi 1",
    "simSlot": 1,
    "sender": "955xx",
    "body": "您的验证码是 123456，请勿泄露",
    "receivedAt": "2026-05-30T08:30:00.000Z"
  }'
```

## Deployment Notes

Run the app behind HTTPS on the VPS. Keep `.env` private. Back up the SQLite database file before system upgrades or deployments.
```

- [ ] **Step 2: Run all automated checks**

Run:

```bash
DATABASE_URL="file:./test.db" npm run db:push
DATABASE_URL="file:./test.db" npm test
npm run build
```

Expected: Prisma db push exits with code 0, all Vitest suites pass, and the Next.js build exits with code 0.

- [ ] **Step 3: Run local manual verification**

Start the app:

```bash
npm run dev
```

In a second terminal, ingest one verification message:

```bash
curl -X POST "http://localhost:3000/api/messages/ingest" \
  -H "Authorization: Bearer $SMS_INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "receivedPhoneNumber": "+8613800000000",
    "deviceName": "Redmi 1",
    "simSlot": 1,
    "sender": "955xx",
    "body": "您的验证码是 123456，请勿泄露",
    "receivedAt": "2026-05-30T08:30:00.000Z"
  }'
```

Expected: response status is `201`, response JSON has `category: "verification"` and `duplicate: false`.

Open `http://localhost:3000`, enter `WEB_ACCESS_KEY`, and verify:

- The message appears in the inbox.
- The source label is `Redmi 1 · SIM 1`.
- The unread count is `1`.
- Marking the message read changes the unread count to `0`.
- Changing the category to `other` updates the category label.
- Enabling notifications and ingesting a second verification message shows one browser notification.
- Ingesting a loan or other message does not show a browser notification.

- [ ] **Step 4: Commit**

Run:

```bash
git add README.md
git commit -m "docs: add sms platform usage guide"
```

---

## Coverage Map

- Receiving API: Task 7.
- Database and source/message schema: Task 2 and Task 6.
- Duplicate prevention: Task 3 and Task 6.
- Conservative verification keyword classification: Task 5.
- Kimi classification and failure fallback: Task 5.
- Read/unread and manual category edits: Task 6, Task 8, Task 10.
- Protected web access key: Task 4 and Task 9.
- Inbox filters and stats: Task 8 and Task 10.
- Auto-refreshing web inbox: Task 10.
- Browser notifications for verification messages only: Task 11.
- Deployment and phone-client curl example: Task 12.

## Final Verification Command Set

Run these commands before claiming the implementation is complete:

```bash
DATABASE_URL="file:./test.db" npm run db:push
DATABASE_URL="file:./test.db" npm test
npm run build
git status --short
```

Expected:

- `prisma db push` exits with code 0.
- Vitest reports all tests passing.
- Next.js build exits with code 0.
- `git status --short` shows no uncommitted implementation changes after the final commit.
