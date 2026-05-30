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

export function hasValidWebAccessKey(
  received: unknown,
  expected = process.env.WEB_ACCESS_KEY
) {
  return Boolean(
    typeof received === "string" && expected && safeEqual(received, expected)
  );
}

export function createAccessCookieValue(
  webAccessKey = process.env.WEB_ACCESS_KEY
) {
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
