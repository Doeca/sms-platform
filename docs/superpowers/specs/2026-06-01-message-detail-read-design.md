# Message Detail Read Flow

## Goal

Add a normal-mode message reading flow to the inbox. Today unread messages can
only be cleared through select mode and batch mark-read. Users should be able to
click one SMS, open a centered detail dialog, and have that SMS marked read at
the same time.

The design keeps the current compact iOS-style inbox: category tabs, read-state
filtering, unread blue dots, and select mode all remain intact.

## Scope

This design covers:

- Opening a centered detail dialog from one visible message.
- Marking an unread message as read when that message is opened.
- Keeping the opened message visible in the current list, including when the
  read-state filter is `未读`.
- Showing complete message details in the dialog.
- Preserving manual category correction in both the list and the dialog.
- Handling read-update failures without losing the current view.

This design does not add message deletion, reply actions, mark-unread actions,
threading, routing, a separate detail page, or a backend bulk/read endpoint.

## Current Context

`InboxApp` owns the list state, active category, read-state filter, select mode,
selected message IDs, refresh behavior, and calls to `updateMessage`.

`MessageList` renders a list of `MessageItem` components.

`MessageItem` currently has two modes:

- Normal mode shows unread state and the compact category correction select.
- Select mode turns the row into a selection target and hides the unread dot.

This feature should extend normal mode without changing select mode behavior.

## Interaction Design

In normal mode, clicking a message row opens a centered dialog. The row should
also be keyboard-accessible with `Enter` and `Space`.

If the opened message is unread, the UI immediately treats it as read:

- The blue unread dot disappears.
- The message remains in the current list.
- Category unread counts and total unread count decrement locally.
- The frontend sends `PATCH /api/messages/:id` with `{ "isRead": true }`.

If the current read-state filter is `未读`, the opened message still stays in
place after being marked read. This avoids the jarring behavior of a message
disappearing while the user is reading it. The item can disappear later after a
full refresh, filter change, category change, or poll-driven reload.

Select mode keeps its existing behavior. Clicking a row in select mode toggles
selection and never opens the detail dialog.

Clicking the category select inside a message row should not open the dialog.
The category select continues to update the message category as it does today.

## Detail Dialog

The dialog is centered with a light backdrop. It should feel like a compact
reading surface, not a new page.

The dialog shows:

- Sender.
- Source label, such as device name / SIM slot / received phone number.
- Received time.
- Full SMS body with original line breaks preserved.
- Current category as a select control.

The dialog can be closed by:

- Close button.
- Clicking the backdrop.
- Pressing `Escape`.

When opened by keyboard, focus should move into the dialog. When the dialog
closes, focus should return to the message row that opened it when possible.

## Data Flow

`InboxApp` should own the selected/open message state because it already owns
message fetching and updates.

Opening a message should:

1. Store the opened message ID.
2. If the message is unread, optimistically mark it read in local inbox state.
3. Send `updateMessage(id, { isRead: true })`.
4. If the update succeeds, leave the local state as-is.
5. If the update fails, show `短信更新失败` and refresh the visible messages so
   the UI returns to server truth.

The notification message feed should still refresh independently. Reading a
message from the visible list should not block notification polling.

Category changes from the dialog use the existing `updateMessage(id, { category })`
flow. After a successful category change, the visible messages should refresh,
matching the current list-category correction behavior.

## State Rules

The opened message should be resolved from the current `inbox.messages` array
by ID. If a refresh removes that message from the current list while the dialog
is open, the dialog should close cleanly.

Optimistic read updates should avoid double-patching:

- Opening an already-read message should not call `PATCH` for read state.
- Opening the same unread message again after local state marks it read should
  not send another read-state patch.

Unread stats should never go below zero. Category unread counts should only
decrement for the opened message's current category.

## Error Handling

If the read-state patch fails:

- Show the existing inbox error area with `短信更新失败`.
- Refresh visible messages.
- Keep the dialog open if the message still exists after refresh.
- Close the dialog if the message no longer exists in the visible result.

If the category patch from the dialog fails:

- Show `短信更新失败`.
- Keep the dialog open.

If refreshing after a failed update also fails, preserve the current view and
show the existing refresh/update error message pattern.

## Accessibility

The dialog should use `role="dialog"` and `aria-modal="true"`, with an accessible
title based on the sender, such as `短信详情 955xx`.

Normal-mode message rows should expose a button-like interaction without
nesting the category select inside a native button. A row-level `article` with
`role="button"`, `tabIndex=0`, click handling, and keyboard handling is acceptable
as long as interactions originating from the category select are ignored.

Focus-visible styling should be added for the clickable normal row and dialog
controls.

## Testing

Frontend unit tests should cover:

- Clicking a normal unread row opens the dialog.
- Opening an unread row calls `PATCH /api/messages/:id` with `{ isRead: true }`.
- The unread dot disappears after optimistic read update.
- In `未读` filter state, the opened message remains visible after optimistic
  read update.
- Clicking the category select does not open the dialog.
- Select mode row clicks still toggle selection and do not open the dialog.
- Opening an already-read row does not send a read-state patch.
- The dialog displays sender, source label, received time, body, and category
  select.
- Closing works through the close button and Escape.
- Read-update failure shows `短信更新失败` and refreshes messages.

Responsive browser checks should verify that the centered dialog fits on mobile
widths, keeps the body readable, and does not overlap the existing bulk action
bar because select mode and dialog mode are mutually exclusive.
