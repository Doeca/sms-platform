# iOS-Style SMS Inbox Redesign

## Goal

Redesign the SMS inbox frontend so the mobile experience feels closer to the iOS Messages app and uses the screen more efficiently. The existing large statistics panel will be removed from the main mobile flow. Users should be able to browse by category, see unread state through a blue dot, filter by read state, and multi-select messages to mark them read.

The backend classifier also needs a focused correction: Kimi must be able to classify messages as verification codes, financial loan/repayment/overdue/collection messages, or other messages. Keyword matching still runs first, but Kimi is the fallback classifier for all three categories.

## Scope

This design covers:

- Replacing the stats block with category tabs.
- Creating three frontend category pages inside one inbox view: verification, financial, and other.
- Displaying unread messages with an iOS-style blue dot.
- Adding a select mode with multi-select and batch mark-read behavior.
- Moving read-state filtering into a lightweight filter panel.
- Removing source filtering from the UI while preserving source labels on messages.
- Preserving manual category correction as a compact per-message action.
- Expanding Kimi classification from two categories to three categories.

This design does not add user accounts, push infrastructure, a bulk backend API, source filtering, message deletion, or database schema changes.

## Frontend Structure

The inbox keeps the existing `SMS Inbox / 短信聚合收件箱` header. Header actions become compact controls:

- `筛选` opens a lightweight read-state filter panel.
- `选择` enters multi-select mode.
- The browser notification control remains available but should be visually lighter than the current large button so it does not dominate the mobile header.

The current five-cell statistics block is removed from the main layout. It is replaced by a top segmented category tab control:

- `验证码`
- `金融`
- `其他`

Each tab shows the unread count for that category when the count is greater than zero. The `金融` label is frontend copy only; it maps to the existing `loan_collection` category.

The old category dropdown is removed because the active tab now owns category selection.

## Message List Design

Normal mode prioritizes scanning:

- An unread blue dot appears at the leading edge of unread messages.
- Read messages have no blue dot.
- Each item shows sender, body preview, received time, and source label.
- The source label remains visible because the user has many SIM cards and needs to know which phone number received the SMS.
- Category badges are removed from the main scan row because the current tab already communicates category.

Unread state should feel like a lightweight list indicator, not a heavy card border. The current strong unread border should be replaced or significantly softened.

Manual category correction remains available as a compact secondary row action, not as a global category filter. This preserves the existing ability to fix a misclassified SMS without making the primary list feel like a management table.

Empty states should match the active tab:

- `没有验证码短信`
- `没有金融短信`
- `没有其他短信`

If a read-state filter is active, the empty text can append the state naturally, such as `没有未读验证码短信`.

## Filtering

Read-state filtering moves into the `筛选` control. The filter panel contains only:

- `全部`
- `未读`
- `已读`

The filter applies to the current category tab. Switching tabs preserves the selected read-state filter. Source filtering is removed from the UI, but the backend `sourceId` query support can remain in place for future use.

The frontend request is built from the active tab and read-state filter:

```text
/api/messages?category=verification&readState=unread
```

## Multi-Select

Clicking `选择` enters select mode:

- Every visible message shows a circular selection control at the leading edge.
- The unread blue dot is hidden while select mode is active so the leading edge has one clear purpose.
- Clicking a message row or its circle toggles selection.
- A fixed bottom action bar shows the number of selected messages.
- The bottom bar offers `标记已读` and `取消`.
- `取消` exits select mode and clears selection.

Batch mark-read behavior reuses the existing single-message API:

```text
PATCH /api/messages/:id
{ "isRead": true }
```

The frontend sends requests for selected unread messages, refreshes the current list, clears selection, and exits select mode. A dedicated backend bulk API is intentionally deferred until message volume or latency requires it.

If all selected messages are already read, the `标记已读` action is disabled.

## Backend Classification Correction

The current Kimi classifier only permits `loan_collection` and `other`, which is too narrow. Keyword verification detection remains first for speed and precision, but if keywords do not match, Kimi must choose among all three categories:

- `verification`
- `loan_collection`
- `other`

The prompt should instruct the model to classify whether the SMS is a verification code, a financial loan/repayment/overdue/collection message, or other content, and to output JSON only.

The allowed JSON responses are:

```json
{"category":"verification"}
{"category":"loan_collection"}
{"category":"other"}
```

The `KimiCategory` type should expand to the full `MessageCategory` union. Parsing should reject anything outside the three allowed values.

If Kimi fails, times out, is misconfigured, or returns invalid JSON, ingestion still succeeds with:

```json
{ "category": "other", "source": "fallback" }
```

The classification error remains recorded for debugging.

## Data Flow

The frontend continues using the existing APIs:

- `GET /api/messages`
- `PATCH /api/messages/:id`
- `POST /api/auth/access`
- `POST /api/messages/ingest`

The message list query combines:

- active category tab
- current read-state filter

The response already includes `stats`, but the current shape does not provide accurate unread counts per category. The implementation should extend the stats payload in a backward-compatible way:

```json
{
  "stats": {
    "all": 12,
    "unread": 5,
    "verification": 4,
    "loan_collection": 3,
    "other": 5,
    "unreadByCategory": {
      "verification": 2,
      "loan_collection": 1,
      "other": 2
    }
  }
}
```

This is an API response shape extension, not a database schema change.

## Error Handling

Kimi errors never block SMS ingestion. They fall back to `other` and preserve the error string.

Batch mark-read should handle partial failure:

- Successful updates remain applied.
- The UI refreshes after the operation.
- If any selected update fails, the user sees a concise error such as `部分短信更新失败`.

If refreshing messages fails, keep the existing inbox error pattern and avoid clearing the current view unnecessarily.

## Testing

Classification tests should cover:

- Kimi accepts `verification`, `loan_collection`, and `other`.
- Kimi rejects unsupported categories.
- A message without verification keywords can still become `verification` when Kimi returns that category.
- Keyword classification still bypasses Kimi when keywords match.
- Kimi failure still falls back to `other`.

Frontend tests should cover:

- Category tabs send the correct `category` query value.
- The `金融` tab maps to `loan_collection`.
- Read-state filter combines with the active tab.
- Source filtering is no longer rendered.
- Unread messages show a blue dot in normal mode.
- Select mode replaces the unread dot with selection controls.
- Multi-select can select and deselect messages.
- Batch mark-read calls the existing update API and exits select mode after refresh.
- The large stats panel is no longer rendered.

Responsive checks should verify that mobile width no longer shows a tall statistics block before the filters and message list.
