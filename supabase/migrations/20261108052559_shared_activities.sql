-- Shared activity documents are accessible only through verified server operations.
create table public.activity_records (
 id uuid primary key, kind text not null check(kind in ('group','activity')),
 revision integer not null check(revision>0), members text[] not null,
 document jsonb not null, updated_at timestamptz not null default now()
);
create index activity_records_members on public.activity_records using gin(members);
create table public.activity_operations (
 actor uuid not null references auth.users(id), key uuid not null,
 record_id uuid not null references public.activity_records(id), result jsonb not null,
 primary key(actor,key)
);
create table public.activity_revisions (
 record_id uuid not null references public.activity_records(id), revision integer not null,
 actor text not null, document jsonb not null, created_at timestamptz not null default now(),
 primary key(record_id,revision)
);
alter table public.activity_records enable row level security;
alter table public.activity_operations enable row level security;
alter table public.activity_revisions enable row level security;
revoke all on public.activity_records,public.activity_operations,public.activity_revisions from public,anon,authenticated;
grant all on public.activity_records,public.activity_operations,public.activity_revisions to service_role;
create function public.commit_activity(p_actor uuid,p_key uuid,p_id uuid,p_kind text,p_expected integer,p_document jsonb)
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
 select array_agg(p->>'email') into people from jsonb_array_elements(p_document->'people') p;
 insert into activity_records(id,kind,revision,members,document) values(p_id,p_kind,p_expected+1,people,p_document)
 on conflict(id) do update set revision=excluded.revision,members=excluded.members,document=excluded.document,updated_at=now();
 insert into activity_revisions(record_id,revision,actor,document) values(p_id,p_expected+1,email,p_document);
 insert into activity_operations(actor,key,record_id,result) values(p_actor,p_key,p_id,p_document);
 return p_document;
end $$;
revoke all on function public.commit_activity(uuid,uuid,uuid,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.commit_activity(uuid,uuid,uuid,text,integer,jsonb) to service_role;
-- A scheduled expense records an agreed upcoming cost, never a fabricated receipt.
create function public.publish_recurring_activity_periods(p_today date default (now() at time zone 'Asia/Seoul')::date)
returns integer language plpgsql security invoker set search_path=public as $$
declare r activity_records; d jsonb; s jsonb; cursor_month date; period_start date; period_key text; due_date date; item jsonb; replies jsonb; new_revision integer; count_published integer:=0; added integer; loops integer;
begin
 for r in select * from activity_records where kind='activity' and document ? 'schedule' for update skip locked loop
  d:=r.document;s:=d->'schedule';added:=0;loops:=0;
  if coalesce((s->>'paused')::boolean,false) or coalesce((s->>'variable')::boolean,false) then continue;end if;
  if exists(select 1 from jsonb_array_elements(s->'expense'->'participants') p where not(s->'accepted' ? (p->>'email'))) then continue;end if;
  cursor_month:=date_trunc('month',(s->>'start')::date)::date;
  while cursor_month<=p_today and loops<1200 loop
   loops:=loops+1;
   period_start:=cursor_month+(least(extract(day from (s->>'start')::date)::int,extract(day from cursor_month+interval '1 month - 1 day')::int)-1);
   if period_start>p_today then exit;end if;
   period_key:=to_char(cursor_month,'YYYY-MM');
   if period_start>=coalesce((s->>'resumeFrom')::date,(s->>'start')::date) and not exists(select 1 from jsonb_array_elements(d->'expenses') e where e->>'period'=period_key) then
    due_date:=(cursor_month+case when (s->>'dueDay')::int<extract(day from period_start)::int then interval '1 month' else interval '0' end)::date+((s->>'dueDay')::int-1);
    select jsonb_object_agg(email,jsonb_build_object('revision',1,'status','accepted','reason','Recurring terms v'||(s->>'version'))) into replies from jsonb_array_elements_text(s->'accepted') email;
    item:=jsonb_build_object('id',gen_random_uuid(),'revision',1,'organizer',d->>'owner','expense',(s->'expense')||jsonb_build_object('mode','planned','title',(s->'expense'->>'title')||' · '||period_key),'responses',replies,'repayments','[]'::jsonb,'audit',jsonb_build_array(jsonb_build_object('actor',d->>'owner','action','Scheduled period '||period_key||'; terms v'||(s->>'version'),'at',now())),'period',period_key,'dueDate',due_date);
    d:=jsonb_set(d,'{expenses}',(d->'expenses')||jsonb_build_array(item));
    d:=jsonb_set(d,'{messages}',(d->'messages')||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'actor',d->>'owner','text','Scheduled '||period_key||': '||(s->'expense'->>'title')||'. Due '||due_date||'.','at',now())));
    added:=added+1;
   end if;
   cursor_month:=(cursor_month+interval '1 month')::date;
  end loop;
  if added>0 then
   new_revision:=r.revision+1;d:=jsonb_set(d,'{revision}',to_jsonb(new_revision));
   update activity_records set document=d,revision=new_revision,updated_at=now() where id=r.id;
   insert into activity_revisions(record_id,revision,actor,document) values(r.id,new_revision,'scheduler',d);
   count_published:=count_published+added;
  end if;
 end loop;
 return count_published;
end $$;
revoke all on function public.publish_recurring_activity_periods(date) from public,anon,authenticated;
grant execute on function public.publish_recurring_activity_periods(date) to service_role;
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('splitflow-recurring-periods','0 * * * *','select public.publish_recurring_activity_periods();');
create table public.activity_drafts (
 owner uuid not null references auth.users(id) on delete cascade,
 activity_id uuid not null references public.activity_records(id), slot text not null,
 revision integer not null, key uuid not null, document jsonb not null,
 primary key(owner,activity_id,slot)
);
alter table public.activity_drafts enable row level security;
revoke all on public.activity_drafts from public,anon,authenticated;
grant all on public.activity_drafts to service_role;
create function public.save_activity_draft(p_owner uuid,p_activity uuid,p_slot text,p_expected integer,p_key uuid,p_document jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare prior activity_drafts;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||p_activity::text||p_slot,0));
 select * into prior from activity_drafts where owner=p_owner and activity_id=p_activity and slot=p_slot for update;
 if found then
  if prior.key=p_key then return jsonb_build_object('revision',prior.revision,'expense',prior.document);end if;
  if prior.revision<>p_expected then raise exception 'STALE_REVISION';end if;
 else if p_expected<>0 then raise exception 'STALE_REVISION';end if;end if;
 insert into activity_drafts(owner,activity_id,slot,revision,key,document) values(p_owner,p_activity,p_slot,p_expected+1,p_key,p_document)
 on conflict(owner,activity_id,slot) do update set revision=excluded.revision,key=excluded.key,document=excluded.document;
 return jsonb_build_object('revision',p_expected+1,'expense',p_document);
end $$;
revoke all on function public.save_activity_draft(uuid,uuid,text,integer,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_activity_draft(uuid,uuid,text,integer,uuid,jsonb) to service_role;
