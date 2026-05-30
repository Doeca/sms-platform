# SMS Aggregation Web App Design

## Goal

Build a public-VPS deployable web system for aggregating SMS messages from existing Android forwarding clients. The system receives pushed SMS messages, stores them in a database, classifies them, and presents them in a protected web inbox.

The first version focuses on personal use:

- Phone-side forwarding already exists and is out of scope.
- The web system includes the receiving API, database, classification logic, and inbox UI.
- The UI shows which phone number, device, and SIM slot received each SMS.
- Messages support per-message read and unread state.
- Categories are `verification`, `loan_collection`, and `other`.
- Browser notifications are only sent for newly received verification-code messages.

## Chosen Approach

Use a single full-stack Next.js application with Prisma and SQLite.

This keeps deployment and maintenance simple for a personal tool while preserving a clean path to migrate the database later if message volume grows. The app will run on a public VPS behind HTTPS.

## Architecture

The application has these main parts:

- Ingest API: receives SMS messages from Android forwarding clients.
- Classification service: applies keyword rules first, then calls Kimi for unresolved messages.
- Database layer: stores message content, source information, read state, classification metadata, and classification errors.
- Protected web inbox: displays, filters, refreshes, and updates messages.
- Browser notification client: requests notification permission and alerts only for new verification-code messages.

The phone client sends requests to `POST /api/messages/ingest` with an ingest token. The web inbox is protected by a separate access key. After the access key is accepted, the app sets an httpOnly cookie so later page loads and API requests can access the inbox.

## Data Model

### Message Source

Each message belongs to a source. The receiving phone number is required; device name and SIM slot are optional.

Fields:

- `id`
- `receivedPhoneNumber`
- `deviceName`
- `simSlot`
- `createdAt`
- `updatedAt`

The UI should display source information in this priority order:

1. Device name plus SIM slot, when available.
2. Device name, when available.
3. Receiving phone number.

### Message

Fields:

- `id`
- `sourceId`
- `sender`
- `body`
- `receivedAt`
- `category`: `verification`, `loan_collection`, or `other`
- `classificationSource`: `keyword`, `kimi`, `manual`, or `fallback`
- `classificationError`
- `isRead`
- `dedupeKey`
- `createdAt`
- `updatedAt`

Messages are unread by default.

The initial duplicate check uses this stable key:

`receivedPhoneNumber + sender + body + receivedAt`

This prevents duplicate inserts when the phone client retries the same message.

## Ingest API

Endpoint:

`POST /api/messages/ingest`

Authentication:

- Requires `Authorization: Bearer <SMS_INGEST_TOKEN>`.
- Invalid tokens return `401`.

Expected JSON body:

```json
{
  "receivedPhoneNumber": "+8613800000000",
  "deviceName": "Redmi 1",
  "simSlot": 1,
  "sender": "955xx",
  "body": "您的验证码是 123456，请勿泄露",
  "receivedAt": "2026-05-30T08:30:00.000Z"
}
```

Required fields:

- `receivedPhoneNumber`
- `sender`
- `body`
- `receivedAt`

Optional fields:

- `deviceName`
- `simSlot`

Validation failures return `400` and do not write to the database.

## Classification

Classification happens during ingest.

The flow is:

1. Run conservative keyword detection for verification-code messages.
2. If verification keywords match, set category to `verification` and source to `keyword`.
3. If no keyword rule matches, call Kimi.
4. Kimi may only classify the message as `loan_collection` or `other`.
5. If Kimi fails, times out, or returns an invalid result, store the message as `other`, set source to `fallback`, and record the error.

Conservative verification keywords include:

- `验证码`
- `校验码`
- `动态码`
- `OTP`
- `verification code`

The first version intentionally avoids aggressive numeric-code detection. Ambiguous messages should go to Kimi instead of being incorrectly classified as verification codes.

Kimi configuration is provided by environment variables. The app should never hard-code the API key.

Manual category changes from the web UI set `classificationSource` to `manual`.

## Web Inbox

The first screen is the actual SMS inbox.

Primary UI elements:

- Summary counts for all messages, unread messages, verification messages, loan/collection messages, and other messages.
- Filters for read state: all, unread, read.
- Filter for category.
- Filter for message source.
- Message list showing category, read state, receiving source, sender, received time, and body.
- Per-message action to mark read or unread.
- Per-message category editor.
- Notification toggle for verification-code browser notifications.

The page automatically refreshes by fetching new data every 5 seconds.

The first version does not include:

- Multiple user accounts.
- Full-text search.
- Bulk operations.
- A source management settings page.

## Browser Notifications

Browser notifications are client-side only.

Behavior:

- The user can enable notifications from the inbox.
- If permission is granted, the browser shows notifications for newly observed `verification` messages only.
- Other categories never trigger browser notifications in the first version.
- If permission is denied, the inbox still refreshes normally.

The notification title should identify that a verification SMS arrived. The body should include the sender and source label, without requiring the user to open the page to know which phone received it.

## API For The Inbox

### Enter Access Key

`POST /api/auth/access`

Accepts the web access key, compares it to the configured secret, and sets an httpOnly cookie when valid.

### List Messages

`GET /api/messages`

Supports filters:

- read state: all, unread, read
- category
- source
- `limit`, defaulting to 100
- `before`, using a message timestamp or cursor for older pages

The endpoint requires web access authentication.

### Update Message

`PATCH /api/messages/:id`

Supports:

- `isRead`
- `category`

Changing `category` from the UI sets `classificationSource` to `manual`.

The endpoint requires web access authentication.

## Authentication

There are two secrets:

- Ingest token: used by Android forwarding clients.
- Web access key: used by the browser inbox.

They must be configured independently through environment variables.

The web access key is intentionally simple for the first version: the user enters the key once, then the server sets an httpOnly cookie. This avoids a full user system while still protecting sensitive SMS content on a public VPS.

## Error Handling

- Invalid ingest token returns `401` and writes nothing.
- Invalid ingest payload returns `400` and writes nothing.
- Duplicate messages return success with the existing message rather than inserting again.
- Kimi errors do not block ingest; the message is stored as `other` with an error recorded.
- Database write failures return `500`, allowing the phone client to retry.
- Invalid web access key does not expose inbox data.
- Browser notification denial does not affect message fetching or display.

## Testing Plan

Automated coverage should focus on the behavior that protects data correctness:

- Ingest authentication.
- Ingest payload validation.
- Duplicate-message handling.
- Conservative verification keyword classification.
- Kimi classification mapping.
- Kimi failure fallback to `other`.
- Message filtering by read state, category, and source.
- Marking a message read or unread.
- Manual category editing.
- Web API protection when no valid access cookie is present.

Manual verification should cover:

- The inbox loads after entering the web access key.
- The page refreshes automatically.
- New verification messages trigger browser notifications when permission is granted.
- Non-verification messages do not trigger notifications.
- Filters and per-message updates work from the UI.

## Deployment Assumptions

- The app runs on a public VPS with HTTPS handled by the deployment layer or reverse proxy.
- SQLite is acceptable for the first personal-use version.
- Environment variables provide all secrets and Kimi settings.
- The Android forwarding client can send the agreed JSON payload and token header.

## Success Criteria

The first version is successful when:

- Android clients can push SMS messages to the public server.
- Messages are stored without duplicates on retries.
- The inbox shows source phone, optional device, optional SIM slot, sender, time, body, category, and read state.
- Verification messages are recognized by conservative keyword rules.
- Non-verification messages are classified by Kimi or safely fall back to `other`.
- Categories can be manually corrected.
- Each message can be marked read or unread.
- The page refreshes automatically.
- Browser notifications fire only for new verification messages.
- The public inbox is protected by an access key.
