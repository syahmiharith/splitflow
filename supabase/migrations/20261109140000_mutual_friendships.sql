-- Friendship is a two-person group whose joined list records independent consent.
-- Existing records remain readable; no legacy group is promoted into friendship.
create function public.friendship_pair_key(p_document jsonb)
returns text language sql immutable strict set search_path=public,pg_temp as $$
 select string_agg(lower(p->>'email'),chr(31) order by lower(p->>'email'))
 from jsonb_array_elements(p_document->'people') p
$$;
create unique index activity_friendship_pair on public.activity_records
 (public.friendship_pair_key(document))
 where kind='group' and document->'friendship'='true'::jsonb;

create function public.assert_mutual_friendships(p_email text,p_people text[])
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare pair text; other text;
begin
 -- Pair locks serialize expense preparation with either friend's revocation.
 for other,pair in
  select person,least(p_email,person)||chr(31)||greatest(p_email,person)
  from (select distinct unnest(p_people) person) people
  where person<>p_email order by 2
 loop
  perform pg_advisory_xact_lock(hashtextextended('friendship:'||pair,0));
  if not exists(select 1 from activity_records r
   where r.kind='group' and r.document->'friendship'='true'::jsonb
    and friendship_pair_key(r.document)=pair
    and r.document->'joined' ? p_email and r.document->'joined' ? other)
  then raise exception 'MUTUAL_FRIENDSHIP_REQUIRED';end if;
 end loop;
end $$;
revoke all on function public.assert_mutual_friendships(text,text[]) from public,anon,authenticated;
grant execute on function public.assert_mutual_friendships(text,text[]) to service_role;

create function public.assert_activity_trust(p_email text,p_kind text,p_before jsonb,p_after jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare people text[]; joined text[]; other text; item jsonb; old_item jsonb; pair text;
begin
 select array_agg(p->>'email') into people from jsonb_array_elements(p_after->'people') p;
 if p_after->'friendship'='true'::jsonb then
  if p_kind<>'group' or coalesce(cardinality(people),0)<>2 or people[1]=people[2]
   or not(p_email=any(people)) then raise exception 'INVALID_FRIENDSHIP';end if;
  pair:=friendship_pair_key(p_after);
  perform pg_advisory_xact_lock(hashtextextended('friendship:'||pair,0));
  select array_agg(value) into joined from jsonb_array_elements_text(p_after->'joined');
  if exists(select 1 from unnest(joined) j where not(j=any(people)))
   or cardinality(joined)<>(select count(distinct j) from unnest(joined) j)
  then raise exception 'INVALID_FRIENDSHIP';end if;
  if p_before is null then
   if coalesce(cardinality(joined),0)<>1 or joined[1]<>p_email then raise exception 'FRIEND_CONSENT_REQUIRED';end if;
  else
   if p_before->'friendship' is distinct from 'true'::jsonb
    or (p_before-'revision'-'joined'-'invitations') is distinct from (p_after-'revision'-'joined'-'invitations')
   then raise exception 'IMMUTABLE_FRIENDSHIP_PAIR';end if;
   foreach other in array people loop
    if other<>p_email and (p_before->'joined' ? other) is distinct from (p_after->'joined' ? other)
    then raise exception 'FRIEND_CONSENT_REQUIRED';end if;
   end loop;
  end if;
  return;
 end if;
 if p_before->'friendship'='true'::jsonb then raise exception 'IMMUTABLE_FRIENDSHIP_PAIR';end if;
 if p_before is null then
  perform assert_mutual_friendships(p_email,people);
 elsif p_kind='group' then
  perform assert_mutual_friendships(p_email,array(
   select p->>'email' from jsonb_array_elements(p_after->'people') p
   where not exists(select 1 from jsonb_array_elements(p_before->'people') old where old->>'email'=p->>'email')
  ));
 end if;
 if p_kind='activity' then
  -- Historical discussion is preserved. New person-to-person messages are disabled.
  if exists(select 1 from jsonb_array_elements(coalesce(p_after->'messages','[]'::jsonb)) m
   where m->>'kind'='message' and not exists(
    select 1 from jsonb_array_elements(coalesce(p_before->'messages','[]'::jsonb)) old where old=m))
  then raise exception 'DIRECT_MESSAGES_DISABLED';end if;
  for item in select value from jsonb_array_elements(coalesce(p_after->'expenses','[]'::jsonb)) loop
   select value into old_item from jsonb_array_elements(coalesce(p_before->'expenses','[]'::jsonb)) where value->>'id'=item->>'id';
   if old_item is null or old_item->'expense' is distinct from item->'expense' then
    perform assert_mutual_friendships(p_email,array(select p->>'email' from jsonb_array_elements(item->'expense'->'participants') p));
   end if;
  end loop;
  if p_after->'schedule'->'expense' is not null and p_before->'schedule'->'expense' is distinct from p_after->'schedule'->'expense' then
   perform assert_mutual_friendships(p_email,array(select p->>'email' from jsonb_array_elements(p_after->'schedule'->'expense'->'participants') p));
  end if;
 end if;
end $$;
revoke all on function public.assert_activity_trust(text,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.assert_activity_trust(text,text,jsonb,jsonb) to service_role;

create or replace function public.commit_activity(p_actor uuid,p_key uuid,p_id uuid,p_kind text,p_expected integer,p_document jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare current_row activity_records; prior activity_operations; email text; people text[];
begin
 select lower(u.email) into email from auth.users u where u.id=p_actor and u.email_confirmed_at is not null;
 if email is null then raise exception 'ACCESS_DENIED';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text||p_key::text,0));
 select * into current_row from activity_records where id=p_id;
 if found and not(email=any(current_row.members)) then raise exception 'ACCESS_DENIED';end if;
 select * into prior from activity_operations where actor=p_actor and key=p_key;
 if found then if prior.record_id<>p_id then raise exception 'ACCESS_DENIED';end if;return prior.result;end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into current_row from activity_records where id=p_id for update;
 if found then
  if not(email=any(current_row.members)) or current_row.kind<>p_kind then raise exception 'ACCESS_DENIED';end if;
  if current_row.revision<>p_expected then raise exception 'STALE_REVISION';end if;
  if current_row.document->>'owner'<>p_document->>'owner' then raise exception 'ACCESS_DENIED';end if;
 else
  if p_expected<>0 then raise exception 'STALE_REVISION';end if;
  if p_document->>'owner'<>email then raise exception 'ACCESS_DENIED';end if;
 end if;
 if p_document->>'id'<>p_id::text or (p_document->>'revision')::int<>p_expected+1 then raise exception 'STALE_REVISION';end if;
 perform assert_activity_trust(email,p_kind,current_row.document,p_document);
 select array_agg(p->>'email') into people from jsonb_array_elements(p_document->'people') p;
 insert into activity_records(id,kind,revision,members,document) values(p_id,p_kind,p_expected+1,people,p_document)
 on conflict(id) do update set revision=excluded.revision,members=excluded.members,document=excluded.document,updated_at=now();
 insert into activity_revisions(record_id,revision,actor,document) values(p_id,p_expected+1,email,p_document);
 insert into activity_operations(actor,key,record_id,result) values(p_actor,p_key,p_id,p_document);
 return p_document;
end $$;

-- The compatibility pilot endpoint must not bypass mutual friendship checks.
create or replace function public.commit_pilot(p_actor uuid,p_key uuid,p_id uuid,p_expected integer,p_document jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare previous jsonb; current_revision integer; actor_email text; current_document jsonb;
begin
 select lower(email) into actor_email from auth.users where id=p_actor and email_confirmed_at is not null;
 if actor_email is null then raise exception 'ACCESS_DENIED';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text||p_key::text,0));
 select result into previous from pilot_operations where actor=p_actor and key=p_key;
 if found then
  if previous->>'id'<>p_id::text then raise exception 'OPERATION_KEY_REUSED';end if;
  return previous;
 end if;
 if p_expected=0 then
  if p_document->>'organizer'<>actor_email or (p_document->>'revision')::integer<>1 then raise exception 'ACCESS_DENIED';end if;
  perform assert_mutual_friendships(actor_email,array(select p->>'email' from jsonb_array_elements(p_document->'expense'->'participants') p));
  insert into pilot_splits(id,revision,document) values(p_id,1,p_document);
  insert into pilot_memberships(split_id,user_id,email,role) values(p_id,p_actor,actor_email,'organizer');
 else
  if not exists(select 1 from pilot_memberships where split_id=p_id and user_id=p_actor) then raise exception 'ACCESS_DENIED';end if;
  select revision,document into current_revision,current_document from pilot_splits where id=p_id for update;
  if current_revision is distinct from p_expected or (p_document->>'revision')::integer<>p_expected+1 then raise exception 'STALE_REVISION';end if;
  if current_document->'expense' is distinct from p_document->'expense' then
   perform assert_mutual_friendships(actor_email,array(select p->>'email' from jsonb_array_elements(p_document->'expense'->'participants') p));
  end if;
  update pilot_splits set revision=p_expected+1,document=p_document,updated_at=now() where id=p_id;
 end if;
 insert into pilot_revisions(split_id,revision,document) values(p_id,(p_document->>'revision')::integer,p_document);
 insert into pilot_operations(actor,key,split_id,result) values(p_actor,p_key,p_id,p_document);
 return p_document;
end $$;
