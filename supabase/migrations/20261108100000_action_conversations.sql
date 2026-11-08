-- Private assistant turns and reviews. All access passes through authenticated server handlers.
create table public.assistant_threads (
 owner uuid not null references auth.users(id) on delete cascade,
 id uuid not null, revision integer not null, document jsonb not null,
 updated_at timestamptz not null default now(), primary key(owner,id)
);
create table public.assistant_operations (
 owner uuid not null references auth.users(id) on delete cascade,
 thread_id uuid not null, key text not null, result jsonb not null,
 primary key(owner,key), foreign key(owner,thread_id) references public.assistant_threads(owner,id) on delete cascade
);
alter table public.assistant_threads enable row level security;
alter table public.assistant_operations enable row level security;
revoke all on public.assistant_threads,public.assistant_operations from public,anon,authenticated;
grant all on public.assistant_threads,public.assistant_operations to service_role;
create function public.save_assistant_thread(p_owner uuid,p_id uuid,p_expected integer,p_key text,p_document jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare prior assistant_threads; saved assistant_operations; v_next jsonb; email text;
begin
 select lower(u.email) into email from auth.users u where u.id=p_owner and email_confirmed_at is not null;
 if email is null then raise exception 'ACCESS_DENIED';end if;
 perform pg_advisory_xact_lock(hashtextextended('assistant:'||p_owner::text||p_id::text,0));
 select * into saved from assistant_operations where owner=p_owner and key=p_key;
 if found then if saved.thread_id<>p_id then raise exception 'ACCESS_DENIED';end if;return saved.result;end if;
 select * into prior from assistant_threads where owner=p_owner and id=p_id for update;
 if coalesce(prior.revision,0)<>p_expected then raise exception 'STALE_REVISION';end if;
 if p_document->>'id'<>p_id::text then raise exception 'ACCESS_DENIED';end if;
 if p_document->>'activityId' is not null and not exists(select 1 from activity_records where id=(p_document->>'activityId')::uuid and email=any(members)) then raise exception 'ACCESS_DENIED';end if;
 v_next:=p_document||jsonb_build_object('revision',p_expected+1,'updatedAt',now());
 insert into assistant_threads(owner,id,revision,document) values(p_owner,p_id,p_expected+1,v_next) on conflict(owner,id) do update set revision=excluded.revision,document=excluded.document,updated_at=now();
 insert into assistant_operations(owner,thread_id,key,result) values(p_owner,p_id,p_key,v_next);
 return v_next;
end $$;
revoke all on function public.save_assistant_thread(uuid,uuid,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.save_assistant_thread(uuid,uuid,integer,text,jsonb) to service_role;
create function public.commit_assistant_batch(p_owner uuid,p_id uuid,p_expected integer,p_key text,p_document jsonb,p_results jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare thread assistant_threads; saved assistant_operations; proposal jsonb; op jsonb; dep jsonb; result jsonb; idx integer:=0; lock_id text; email text;
begin
 select lower(u.email) into email from auth.users u where u.id=p_owner and email_confirmed_at is not null;
 if email is null then raise exception 'ACCESS_DENIED';end if;
 perform pg_advisory_xact_lock(hashtextextended('assistant:'||p_owner::text||p_id::text,0));
 select * into saved from assistant_operations where owner=p_owner and key=p_key;
 if found then if saved.thread_id<>p_id then raise exception 'ACCESS_DENIED';end if;return saved.result;end if;
 select * into thread from assistant_threads where owner=p_owner and id=p_id for update;
 if not found or thread.revision<>p_expected then raise exception 'STALE_REVISION';end if;
 proposal:=thread.document->'pending';
 if proposal is null or proposal='null'::jsonb or proposal->>'id' is distinct from p_document->'pending'->>'id' then raise exception 'STALE_REVISION';end if;
 if jsonb_array_length(proposal->'operations')<>jsonb_array_length(p_results) then raise exception 'ACCESS_DENIED';end if;
 -- Stable lock order covers target records and membership dependencies before any write.
 for lock_id in select value from (select x->>'id' as value from jsonb_array_elements(proposal->'operations') x union select x->>'id' from jsonb_array_elements(proposal->'dependencies') x) ids order by value loop
  perform pg_advisory_xact_lock(hashtextextended(lock_id,0));
  perform 1 from activity_records where id=lock_id::uuid for update;
 end loop;
 for dep in select value from jsonb_array_elements(proposal->'dependencies') loop
  if not exists(select 1 from activity_records where id=(dep->>'id')::uuid and revision=(dep->>'revision')::int and email=any(members)) then raise exception 'STALE_REVISION';end if;
 end loop;
 for op in select value from jsonb_array_elements(proposal->'operations') loop
  result:=p_results->idx;
  if result->>'kind'<>op->>'kind' or result->'document'->>'id'<>op->>'id' then raise exception 'ACCESS_DENIED';end if;
  perform commit_activity(p_owner,(op->>'key')::uuid,(op->>'id')::uuid,op->>'kind',(op->>'expected')::int,result->'document');
  idx:=idx+1;
 end loop;
 return save_assistant_thread(p_owner,p_id,p_expected,p_key,p_document||jsonb_build_object('pending',null,'draft',null));
end $$;
revoke all on function public.commit_assistant_batch(uuid,uuid,integer,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.commit_assistant_batch(uuid,uuid,integer,text,jsonb,jsonb) to service_role;
