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

Required fields are `receivedPhoneNumber`, `sender`, `body`, and `receivedAt`.
`deviceName` and `simSlot` are optional, but including them makes the inbox source
labels clearer.

## Classification

Messages are classified with a keyword-first flow:

1. Verification-code keyword rules run locally first.
2. If no verification rule matches, the server calls Kimi.
3. If Kimi is unavailable or misconfigured, the message is saved as `other` with
   a fallback classification source.

The web UI supports manual category changes after ingestion.

## Deployment Notes

Run the app behind HTTPS on the VPS. Keep `.env` private. Back up the SQLite
database file before system upgrades or deployments.
