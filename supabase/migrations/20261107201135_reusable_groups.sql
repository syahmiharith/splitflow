-- Reusable address books are private to their owner; selecting one never grants split access.
create table public.pilot_groups (
 id uuid primary key,
 owner uuid not null references auth.users(id) on delete cascade,
 revision integer not null check(revision>0),
 document jsonb not null,
 updated_at timestamptz not null default now()
);
create index pilot_groups_owner_updated on public.pilot_groups(owner,updated_at desc);
create table public.pilot_group_operations (
 owner uuid not null references auth.users(id) on delete cascade,
 key uuid not null,
 group_id uuid not null references public.pilot_groups(id) on delete cascade,
 result jsonb not null,
 primary key(owner,key)
);
alter table public.pilot_groups enable row level security;
alter table public.pilot_group_operations enable row level security;
revoke all on public.pilot_groups,public.pilot_group_operations from public,anon,authenticated;
grant all on public.pilot_groups,public.pilot_group_operations to service_role;
create policy group_owner_read on public.pilot_groups for select to authenticated using((select auth.uid())=owner);
create policy group_operation_owner_read on public.pilot_group_operations for select to authenticated using((select auth.uid())=owner);
create function public.save_pilot_group(p_owner uuid,p_key uuid,p_expected integer,p_document jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare prior jsonb;existing_owner uuid;current_revision integer;doc_id uuid;
begin
 doc_id:=(p_document->>'id')::uuid;
 if (p_document->>'revision')::integer<>p_expected+1 then raise exception 'STALE_REVISION';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||p_key::text,0));
 select result into prior from pilot_group_operations where owner=p_owner and key=p_key;
 if found then
  if prior->>'id'<>doc_id::text then raise exception 'ACCESS_DENIED';end if;
  return prior;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(doc_id::text,0));
 select owner,revision into existing_owner,current_revision from pilot_groups where id=doc_id for update;
 if found then
  if existing_owner<>p_owner then raise exception 'ACCESS_DENIED';end if;
  if current_revision<>p_expected then raise exception 'STALE_REVISION';end if;
  update pilot_groups set revision=p_expected+1,document=p_document,updated_at=now() where id=doc_id;
 else
  if p_expected<>0 then raise exception 'STALE_REVISION';end if;
  insert into pilot_groups(id,owner,revision,document) values(doc_id,p_owner,1,p_document);
 end if;
 insert into pilot_group_operations(owner,key,group_id,result) values(p_owner,p_key,doc_id,p_document);
 return p_document;
end $$;
revoke all on function public.save_pilot_group(uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.save_pilot_group(uuid,uuid,integer,jsonb) to service_role;
