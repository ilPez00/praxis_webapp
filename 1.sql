-- Users (you may already have something similar; Supabase Auth creates auth.users)
-- But add profile extension if needed
create table profiles (
  id uuid references auth.users primary key,
  username text unique,
  display_name text,
  avatar_url text,
  bio text,
  verified boolean default false,
  domains text[] default '{}',
  created_at timestamptz default now()
);

-- Conversations (1-on-1 for simplicity; later add group)
create table conversations (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  participant_ids uuid[] not null  -- array of user ids (sorted)
);
-- Unique index to prevent duplicate convos
create unique index unique_conversation on conversations (participant_ids);

-- Messages
create table messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid references conversations(id) on delete cascade,
  sender_id uuid references auth.users(id),
  content text not null,
  created_at timestamptz default now(),
  read_by uuid[] default '{}'  -- for read receipts
);

-- Enable realtime on messages & conversations
alter publication supabase_realtime add table messages, conversations;
