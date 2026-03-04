# API Reference

**Base URL:** `https://web-production-646a4.up.railway.app/api`

All endpoints (except `/health`) require:
```
Authorization: Bearer <supabase-jwt>
```

---

## Health

### `GET /health`
Returns server status. No auth required.

**Response:** `{ status: "ok", timestamp: "..." }`

---

## Users

### `GET /users/me`
Returns the current user's profile.

### `GET /users/:id`
Returns a public profile by ID.

### `PUT /users/me`
Update the current user's profile.

**Body:** `{ name?, bio?, avatar_url?, domains? }`

### `POST /users/complete-onboarding`
Mark onboarding as complete. Sets `onboarding_completed = true`.

### `POST /users/:id/verify`
Submit identity verification for a user.

### `POST /users/me/feedback`
Submit peer feedback on a match interaction.

**Body:** `{ targetUserId, type: "SUCCEEDED"|"DISTRACTED"|"ABANDONED" }`

---

## Goals

### `GET /goals`
Returns the current user's goal tree.

**Response:** `{ nodes: GoalNode[], rootNodes: string[] }`

### `POST /goals`
Save the current user's goal tree.

**Body:** `{ nodes: GoalNode[], rootNodes: string[] }`

### `GET /goals/:userId`
Returns a public goal tree for a specific user.

---

## Matches

### `GET /matches`
Returns potential matches for the current user, ranked by goal similarity.

**Query params:** `?limit=10`

---

## Messages (DMs)

### `GET /messages/:partnerId`
Returns the DM conversation between the current user and `partnerId`.

### `POST /messages`
Send a message.

**Body:** `{ receiverId, content, mediaUrl?, mediaType? }`

### `GET /messages/partners`
Returns the list of DM conversation partners.

---

## Completions (Peer Verification)

### `POST /completions`
Request peer verification for a goal node completion.

**Body:** `{ verifierId, goalNodeId, goalTitle }`

### `GET /completions/incoming`
Returns pending verification requests addressed to the current user.

### `PUT /completions/:id`
Approve or reject a verification request.

**Body:** `{ action: "APPROVE"|"REJECT" }`

---

## Groups

### `GET /groups`
Returns all group chat rooms.

### `POST /groups`
Create a new group.

**Body:** `{ name, description? }`

### `GET /groups/:id`
Returns a single group's details and members.

### `POST /groups/:id/join`
Join a group.

### `DELETE /groups/:id/leave`
Leave a group.

### `GET /groups/:id/messages`
Returns messages in a group chat.

### `POST /groups/:id/messages`
Send a message to a group.

**Body:** `{ content }`

---

## Posts (Boards)

### `GET /posts`
Returns posts. Optionally scoped to a board.

**Query params:** `?context=<roomId>` (for board-scoped posts)

### `POST /posts`
Create a post.

**Body:** `{ content, context?, title? }`

### `POST /posts/:id/vote`
Upvote or remove vote on a post.

### `GET /posts/:id/comments`
Returns comments on a post.

### `POST /posts/:id/comments`
Add a comment to a post.

**Body:** `{ content }`

---

## Coaching

### `POST /coaching/generate`
Generate an AI coaching report for the current user.

**Response:** A structured Markdown report from Gemini covering goal progress, strengths, and action items. Premium-gated.

---

## Achievements

### `GET /achievements/:userId`
Returns achievements for a user.

### `POST /achievements`
Create an achievement (usually auto-created on peer verification approval).

**Body:** `{ title, description, goalNodeId? }`

---

## Payments (Stripe)

### `POST /payments/create-checkout-session`
Creates a Stripe Checkout session.

**Response:** `{ url: "https://checkout.stripe.com/..." }`

### `POST /payments/webhook`
Stripe webhook endpoint. Handles `checkout.session.completed` to grant Premium.

---

## Admin

### `POST /admin/seed-demo-users`
Seeds demo users for the Match feed. Requires `X-Admin-Secret` header matching `ADMIN_SECRET` env var.

---

## Error Format

All errors return:
```json
{
  "error": "Human-readable message",
  "code": "OPTIONAL_CODE"
}
```

Common status codes:
- `400` — Bad request / validation error
- `401` — Missing or invalid JWT
- `403` — Forbidden (insufficient permissions or premium gate)
- `404` — Resource not found
- `500` — Internal server error
