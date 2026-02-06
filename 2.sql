-- Users can only read own profile
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);

-- Messages: participants only
create policy "Participants can read messages" on messages for select
using (auth.uid() = ANY (select participant_ids from conversations where id = conversation_id));

create policy "Participants can insert messages" on messages for insert
with check (auth.uid() = sender_id and auth.uid() = ANY (select participant_ids from conversations where id = conversation_id));
