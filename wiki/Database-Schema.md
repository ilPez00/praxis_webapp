# Database Schema

All tables live in the `public` schema in Supabase (PostgreSQL).
Run `migrations/setup.sql` to create all tables idempotently.

---

## Core Tables

### `profiles`
Extends Supabase Auth users.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK, references `auth.users.id` |
| `name` | `text` | Display name |
| `bio` | `text` | Short bio |
| `avatar_url` | `text` | URL to avatar in Supabase Storage |
| `domains` | `text[]` | Selected goal domains |
| `is_premium` | `boolean` | Stripe premium status |
| `is_verified` | `boolean` | Identity verification status |
| `onboarding_completed` | `boolean` | Whether user finished onboarding |
| `goal_tree_edit_count` | `integer` | Number of goal tree edits (free gate) |
| `current_streak` | `integer` | Daily activity streak |
| `praxis_points` | `integer` | Gamification points |
| `created_at` | `timestamptz` | |

---

### `goal_trees`
Stores each user's hierarchical goal structure as JSONB.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | FK → `profiles.id` |
| `nodes` | `jsonb` | Array of `GoalNode` objects |
| `root_nodes` | `text[]` | IDs of top-level nodes |
| `updated_at` | `timestamptz` | |

**GoalNode shape (JSONB):**
```json
{
  "id": "uuid",
  "title": "Start a SaaS company",
  "customDetails": "Description / context",
  "completionMetric": "First paying customer",
  "targetDate": "2026-12-31",
  "weight": 0.4,
  "domain": "Entrepreneurship",
  "children": ["child-node-id-1"],
  "parentId": null
}
```

---

### `goal_embeddings`
Vector embeddings for semantic matching (pgvector).

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | FK → `profiles.id` |
| `node_id` | `text` | References a node ID in `goal_trees.nodes` |
| `embedding` | `vector(768)` | Gemini text-embedding-004 output |
| `created_at` | `timestamptz` | |

Requires: `CREATE EXTENSION IF NOT EXISTS vector;`

SQL function `match_users_by_goals(user_id, limit)` performs cosine similarity search.

---

## Social Tables

### `messages`
Direct messages between users.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `sender_id` | `uuid` | FK → `profiles.id` |
| `receiver_id` | `uuid` | FK → `profiles.id` |
| `content` | `text` | Message body |
| `media_url` | `text` | Optional media attachment URL |
| `media_type` | `text` | `image` or `video` |
| `type` | `text` | `text`, `completion_request`, `system` |
| `metadata` | `jsonb` | Extra data (e.g., completion request details) |
| `created_at` | `timestamptz` | |

---

### `completion_requests`
Peer goal verification requests.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `requester_id` | `uuid` | FK → `profiles.id` |
| `verifier_id` | `uuid` | FK → `profiles.id` |
| `goal_node_id` | `text` | ID of the goal being verified |
| `goal_title` | `text` | Human-readable goal title |
| `status` | `text` | `pending`, `approved`, `rejected` |
| `created_at` | `timestamptz` | |

On `APPROVE`: an achievement is auto-created in the `achievements` table.

---

### `chat_rooms`
Group chat rooms / community boards.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `name` | `text` | Room name |
| `description` | `text` | Room description |
| `created_by` | `uuid` | FK → `profiles.id` |
| `created_at` | `timestamptz` | |

---

### `chat_room_members`
Many-to-many: users ↔ chat rooms.

| Column | Type | Notes |
|--------|------|-------|
| `room_id` | `uuid` | FK → `chat_rooms.id` |
| `user_id` | `uuid` | FK → `profiles.id` |
| `joined_at` | `timestamptz` | |

---

### `posts`
Reddit-style board posts.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | FK → `profiles.id` |
| `content` | `text` | Post body |
| `title` | `text` | Optional bold heading (for board posts) |
| `context` | `text` | Room ID for board posts; null for global feed |
| `upvotes` | `integer` | Vote count |
| `created_at` | `timestamptz` | |

---

## Gamification Tables

### `achievements`
Auto-created when a peer verification is approved, or manually created.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | FK → `profiles.id` |
| `title` | `text` | Achievement title |
| `description` | `text` | Details |
| `goal_node_id` | `text` | Optional link to goal |
| `created_at` | `timestamptz` | |

---

### `user_subscriptions`
Stripe subscription tracking.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | FK → `profiles.id` |
| `stripe_customer_id` | `text` | |
| `stripe_subscription_id` | `text` | |
| `status` | `text` | `active`, `canceled`, etc. |
| `created_at` | `timestamptz` | |

---

## Storage Buckets

| Bucket | Public | Used For |
|--------|--------|---------|
| `avatars` | Yes | Profile photo uploads |
| `chat-media` | Yes | Image/video DM attachments |

---

## Key SQL Snippets

**Enable pgvector:**
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

**Reset goal edit count (dev):**
```sql
UPDATE profiles SET goal_tree_edit_count = 0 WHERE id = 'your-user-id';
```

**Add posts title column (if missing):**
```sql
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS title TEXT;
```
