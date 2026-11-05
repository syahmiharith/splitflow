-- Financial writes are exclusively committed by the server after session validation.
create table public.pilot_splits (
 id uuid primary key,
 revision integer not null check (revision > 0),
 document jsonb not null,
 updated_at timestamptz not null default now()
);
create table public.pilot_revisions (
 split_id uuid not null references public.pilot_splits(id),
 revision integer not null,
 document jsonb not null,
 created_at timestamptz not null default now(),
 primary key (split_id, revision)
);
create table public.pilot_operations (
 actor uuid not null,
 key uuid not null,
 split_id uuid not null references public.pilot_splits(id),
 result jsonb not null,
 primary key (actor, key)
);
alter table public.pilot_splits enable row level security;
alter table public.pilot_operations enable row level security;
alter table public.pilot_revisions enable row level security;
revoke all on public.pilot_splits, public.pilot_revisions, public.pilot_operations from anon, authenticated;
-- No browser role has direct access. The API checks verified membership before reads.
create function public.commit_pilot(p_actor uuid, p_key uuid, p_id uuid, p_expected integer, p_document jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare previous jsonb; current_revision integer;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text || p_key::text, 0));
 select result into previous from pilot_operations where actor = p_actor and key = p_key;
 if found then
   if previous->>'id' <> p_id::text then raise exception 'OPERATION_KEY_REUSED'; end if;
   return previous;
 end if;
 if p_expected = 0 then
   insert into pilot_splits(id, revision, document) values (p_id, 1, p_document);
 else
   select revision into current_revision from pilot_splits where id = p_id for update;
   if current_revision is distinct from p_expected then raise exception 'STALE_REVISION'; end if;
   update pilot_splits set revision = p_expected + 1, document = p_document, updated_at = now() where id = p_id;
 end if;
 insert into pilot_revisions(split_id,revision,document) values(p_id,(p_document->>'revision')::integer,p_document);
 insert into pilot_operations(actor,key,split_id,result) values(p_actor,p_key,p_id,p_document);
 return p_document;
end $$;
revoke all on function public.commit_pilot(uuid,uuid,uuid,integer,jsonb) from public, anon, authenticated;
grant execute on function public.commit_pilot(uuid,uuid,uuid,integer,jsonb) to service_role;
