# Features

## Onboarding

New users complete a multi-step onboarding flow:
1. **Profile setup** — name, bio, avatar
2. **Domain selection** — choose 1–5 life domains (Career, Health, Relationships, etc.)
3. **Goal tree creation** — build initial weighted goal hierarchy

Users with `onboarding_completed === false` are redirected to `/onboarding` before accessing any private route.

---

## Goal Trees

The core primitive of Praxis. Each user maintains a weighted, hierarchical goal tree.

### Structure
- **Root goals** — top-level objectives (max 3 on free tier)
- **Sub-goals** — breakdown of each root goal into actionable milestones
- **Weights** — each node has a weight (0–1, summing to 1 per level) reflecting priority

### Goal Node Fields
| Field | Required | Description |
|-------|----------|-------------|
| Title | Yes | Goal name |
| Description | Yes | Context and motivation |
| Success Metric | Yes | How you'll know it's achieved |
| Domain | Yes | Life area (Career, Health, etc.) |
| Target Date | No | Optional deadline |
| Weight | Yes | Priority weight (auto-calculated) |

### Editing
- Free tier: 1 free edit (subsequent edits require Premium)
- Premium: unlimited edits
- Gate resets via SQL: `UPDATE profiles SET goal_tree_edit_count = 0`

### Visualization
Goal trees render as an interactive node graph using Framer Motion animations. Horizontal scroll for wide trees. Click a node to expand details.

---

## Matching

Praxis matches you with peers who have goal trees compatible with yours.

### Algorithm
Uses cosine similarity between Gemini text embeddings of goal nodes, weighted by node weights. See [Architecture](Architecture#matching-algorithm) for formula.

**Fallback:** Domain-overlap counting when embeddings aren't available.

### Match Cards
Each match shows:
- User name and avatar
- Compatibility score
- Shared domains
- A preview of their goal tree
- Action buttons: "Connect" (opens DM), "View Profile"

---

## Direct Messaging

Real-time 1-on-1 chat powered by Supabase Realtime.

### Features
- Text messages
- Image and video attachments (uploaded to Supabase Storage `chat-media` bucket)
- **Peer verification cards** — inline cards to approve/reject goal completion requests
- **Video call button** — initiate a WebRTC video call directly from the chat

---

## Video Calls

WebRTC peer-to-peer video calls between matched users.

### How it works
1. User A clicks "Start Video Call" in ChatRoom
2. A `call-invite` broadcast is sent on the chat Supabase channel
3. User B sees an incoming call dialog
4. On accept, both sides join the WebRTC signaling channel `webrtc_{sorted-user-ids}`
5. Offer/answer/ICE exchange happens via Supabase Broadcast
6. Direct peer connection is established using Google STUN servers

---

## Community Groups & Boards

### Groups (Chat rooms)
- Domain-specific community chat rooms
- Members can join/leave
- Real-time group messaging via Supabase Broadcast

### Boards (Reddit-style)
Each group also has a **Posts** board tab:
- Create posts with an optional title (shown as bold heading)
- Upvote posts
- Comment on posts
- Board posts are scoped to the group (`context = roomId`)

---

## Peer Verification

Users can request that a DM partner verify the completion of a goal:

1. On GoalTreePage, click a completed node → "Request Verification"
2. Select a DM partner as verifier
3. A `completion_request` message card appears in the DM chat
4. The verifier clicks "Verify" or "Reject"
5. On approval → an achievement is auto-created and `praxis_points` incremented

---

## AI Performance Coach

Premium feature. Powered by Google Gemini.

The coach receives full context:
- User's goal tree (all nodes, weights, domains)
- Achievement history
- Recent activity (streak, points)

It returns a structured Markdown report with:
- Current goal analysis
- Strengths and momentum areas
- Specific action recommendations
- Weekly focus suggestions

Access: `/ai-coach`

---

## Analytics (Premium)

Advanced progress analytics available to premium users at `/analytics`:
- Goal completion trends
- Streak history
- Domain distribution charts
- Peer interaction stats

---

## Stripe Premium Upgrade

Users can upgrade at `/upgrade`. The flow:
1. Click "Upgrade to Premium" → `POST /payments/create-checkout-session`
2. Redirected to Stripe Checkout
3. On success → `checkout.session.completed` webhook fires → `is_premium = true` in DB
4. User lands on `/success` page

---

## Identity Verification

Users can submit identity verification at `/verify-identity`. This sets `is_verified = true` on their profile, displayed as a verified badge.

---

## Admin

Protected route at `/admin`. Requires admin session. Features:
- Seed demo users (`POST /admin/seed-demo-users` with `X-Admin-Secret`)
- Inspect platform data

---

## Gamification

| Element | How Earned |
|---------|-----------|
| Praxis Points | Goal completions, peer verifications, community activity |
| Streaks | Daily active engagement with goal tree |
| Achievements | Auto-created on peer verification approval |

Displayed on Dashboard as flame chips and achievement cards.
