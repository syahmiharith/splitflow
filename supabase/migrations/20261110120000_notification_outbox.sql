-- Delivery intents commit with the invitation, including assistant batch transactions.
create table public.notification_outbox (
 id uuid primary key default gen_random_uuid(),
 record_id uuid not null references public.activity_records(id),
 recipient text not null, kind text not null check(kind in ('invitation','reminder')),
 event_key text not null unique,
 expense_id text, policy_owner uuid references auth.users(id), reminder_slot integer check(reminder_slot in (0,1)),
 status text not null default 'queued' check(status in ('queued','sending','accepted','failed','suppressed')),
 available_at timestamptz not null default now(), attempts integer not null default 0,
 provider_id text, locked_at timestamptz, created_at timestamptz not null default now()
);
create table public.notification_preferences (
 owner uuid not null references auth.users(id) on delete cascade,
 record_id uuid not null references public.activity_records(id),
 expense_id text, task_key text not null default 'invitation', owner_email text not null, due_at timestamptz,
 enabled boolean not null default false, muted boolean not null default false,
 stopped boolean not null default false, snoozed_until timestamptz,
 revision integer not null default 1, primary key(owner,record_id,task_key), check(task_key=coalesce(expense_id,'invitation'))
);
alter table public.notification_outbox enable row level security;
alter table public.notification_preferences enable row level security;
revoke all on public.notification_outbox, public.notification_preferences from public,anon,authenticated;
grant all on public.notification_outbox, public.notification_preferences to service_role;
create function public.queue_group_invitations() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare invitation record;
begin
 if new.kind <> 'group' then return new; end if;
 for invitation in select key,value from jsonb_each_text(coalesce(new.document->'invitations','{}'::jsonb)) loop
  if invitation.key <> new.document->>'owner'
   and (tg_op='INSERT' or old.document->'invitations'->>invitation.key is distinct from invitation.value) then
   insert into notification_outbox(record_id,recipient,kind,event_key)
   values(new.id,invitation.key,'invitation',new.id::text||':'||invitation.key||':'||invitation.value)
   on conflict(event_key) do nothing;
  end if;
 end loop;
 return new;
end $$;
create trigger queue_group_invitations after insert or update on public.activity_records
for each row execute function public.queue_group_invitations();
revoke all on function public.queue_group_invitations() from public,anon,authenticated;
create function public.claim_notification_jobs(p_limit integer default 20) returns setof public.notification_outbox
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update notification_outbox set status='failed',locked_at=null where status='sending' and locked_at<now()-interval '5 minutes';
 return query update notification_outbox set status='sending',locked_at=now(),attempts=attempts+1
 where id in (select id from notification_outbox where status='queued' and available_at<=now() and attempts<3
 order by available_at for update skip locked limit least(greatest(p_limit,1),20)) returning *;
end $$;
revoke all on function public.claim_notification_jobs(integer) from public,anon,authenticated;
grant execute on function public.claim_notification_jobs(integer) to service_role;

create function public.commit_assistant_notifications(p_owner uuid,p_id uuid,p_expected integer,p_key text,p_document jsonb,p_results jsonb,p_finance_expected integer default null,p_finance_state jsonb default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare email text; thread assistant_threads; saved assistant_operations; command jsonb; prior notification_preferences; result jsonb; task text;
begin
 select lower(u.email) into email from auth.users u where u.id=p_owner and email_confirmed_at is not null;
 if email is null then raise exception 'ACCESS_DENIED';end if;
 perform pg_advisory_xact_lock(hashtextextended('assistant:'||p_owner::text||p_id::text,0));
 select * into saved from assistant_operations where owner=p_owner and key=p_key;
 if found then if saved.thread_id<>p_id then raise exception 'ACCESS_DENIED';end if;return saved.result;end if;
 select * into thread from assistant_threads where owner=p_owner and id=p_id for update;
 if not found or thread.revision<>p_expected then raise exception 'STALE_REVISION';end if;
 if thread.document->'pending' is distinct from p_document->'pending' or thread.document->'pending'->'notifications' is null then raise exception 'ACCESS_DENIED';end if;
 perform pg_advisory_xact_lock(hashtextextended('notifications:'||p_owner::text,0));
 if p_finance_expected is not null then result:=commit_assistant_finance(p_owner,p_id,p_expected,p_key,p_document,p_results,p_finance_expected,p_finance_state);
 else result:=commit_assistant_batch(p_owner,p_id,p_expected,p_key,p_document,p_results);end if;
 for command in select value from jsonb_array_elements(thread.document->'pending'->'notifications'->'commands') loop
  task:=coalesce(command->>'expenseId','invitation');
  if not exists(select 1 from activity_records where id=(command->>'recordId')::uuid and email=any(members) and
    ((command->>'expenseId' is null and kind='group') or (kind='activity' and exists(select 1 from jsonb_array_elements(document->'expenses') e where e->>'id'=command->>'expenseId')))) then raise exception 'ACCESS_DENIED';end if;
  select * into prior from notification_preferences where owner=p_owner and record_id=(command->>'recordId')::uuid and task_key=task for update;
  if coalesce(prior.revision,0)<>(command->>'expected')::int then raise exception 'STALE_REVISION';end if;
  insert into notification_preferences(owner,owner_email,record_id,expense_id,task_key,enabled,muted,stopped,snoozed_until,due_at,revision)
  values(p_owner,email,(command->>'recordId')::uuid,command->>'expenseId',task,(command->>'enabled')::boolean,(command->>'muted')::boolean,(command->>'stopped')::boolean,(command->>'snoozedUntil')::timestamptz,(command->>'dueAt')::timestamptz,(command->>'expected')::int+1)
  on conflict(owner,record_id,task_key) do update set enabled=excluded.enabled,muted=excluded.muted,stopped=excluded.stopped,snoozed_until=excluded.snoozed_until,due_at=excluded.due_at,revision=excluded.revision;
 end loop;
 return result;
end $$;
revoke all on function public.commit_assistant_notifications(uuid,uuid,integer,text,jsonb,jsonb,integer,jsonb) from public,anon,authenticated;
grant execute on function public.commit_assistant_notifications(uuid,uuid,integer,text,jsonb,jsonb,integer,jsonb) to service_role;

-- Eligibility is checked again immediately before delivery; this only schedules bounded intents.
create function public.schedule_notification_reminders() returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare p record; person jsonb; invitation text; anchor timestamptz; slot integer; added integer:=0; changed integer;
begin
 for p in select n.*,r.kind,r.document from notification_preferences n join activity_records r on r.id=n.record_id
  where n.enabled and not n.muted and not n.stopped and n.owner_email=any(r.members) loop
  for person in select value from jsonb_array_elements(p.document->'people') loop
   if person->>'email'=p.document->>'owner' and p.expense_id is null then continue;end if;
   -- Group organizers enable invitation follow-up; other members only control their own reminders.
   if p.owner_email<>p.document->>'owner' and person->>'email'<>p.owner_email then continue;end if;
   if p.expense_id is null then
    invitation:=p.document->'invitations'->>(person->>'email');
    if invitation is null then continue;end if;
    anchor:=invitation::timestamptz-interval '7 days';
   else
    select coalesce(p.due_at,(e->>'dueDate')::timestamptz) into anchor from jsonb_array_elements(p.document->'expenses') e where e->>'id'=p.expense_id;
    if anchor is null then continue;end if;
   end if;
   for slot in 0..1 loop
    insert into notification_outbox(record_id,recipient,kind,event_key,expense_id,policy_owner,reminder_slot,available_at)
    values(p.record_id,person->>'email','reminder','reminder:'||p.record_id::text||':'||p.task_key||':'||(person->>'email')||':'||slot,p.expense_id,p.owner,slot,
     greatest(anchor+case when p.expense_id is null then (3+slot*3)*interval '1 day' else slot*interval '7 days' end,coalesce(p.snoozed_until,anchor)))
    on conflict(event_key) do nothing;
    get diagnostics changed=row_count;added:=added+changed;
   end loop;
  end loop;
 end loop;
 return added;
end $$;
revoke all on function public.schedule_notification_reminders() from public,anon,authenticated;
grant execute on function public.schedule_notification_reminders() to service_role;

create function public.read_notification_deliveries(p_owner uuid,p_record uuid default null,p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare email text; result jsonb;
begin
 select lower(u.email) into email from auth.users u where u.id=p_owner and email_confirmed_at is not null;
 if email is null then raise exception 'ACCESS_DENIED';end if;
 select coalesce(jsonb_agg(to_jsonb(page)),'[]'::jsonb) into result from (
  select n.id,n.record_id as "recordId",n.expense_id as "expenseId",n.recipient,n.kind,n.status,n.available_at as "availableAt",n.attempts
  from notification_outbox n join activity_records r on r.id=n.record_id
  where (p_record is null or n.record_id=p_record) and email=any(r.members) and (n.recipient=email or r.document->>'owner'=email)
  order by n.created_at desc,n.id limit 100 offset greatest(p_offset,0)
 ) page;
 return result;
end $$;
revoke all on function public.read_notification_deliveries(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.read_notification_deliveries(uuid,uuid,integer) to service_role;
