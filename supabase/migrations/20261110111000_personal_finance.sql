create table public.personal_finance (
 owner uuid primary key references auth.users(id) on delete cascade,
 revision integer not null check(revision>0), state jsonb not null,
 updated_at timestamptz not null default now()
);
create table public.personal_finance_audit (
 owner uuid not null references auth.users(id) on delete cascade,
 revision integer not null, proposal_id text not null, commands jsonb not null,
 state jsonb not null, created_at timestamptz not null default now(),
 primary key(owner,revision)
);
alter table public.personal_finance enable row level security;
alter table public.personal_finance_audit enable row level security;
revoke all on public.personal_finance,public.personal_finance_audit from public,anon,authenticated;
grant all on public.personal_finance,public.personal_finance_audit to service_role;

-- Shared writes, private ledger, audit and original operation result commit together.
create function public.commit_assistant_finance(p_owner uuid,p_id uuid,p_expected integer,p_key text,p_document jsonb,p_results jsonb,p_finance_expected integer,p_finance_state jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare thread assistant_threads; saved assistant_operations; ledger personal_finance; proposal jsonb; result jsonb;
begin
 if not exists(select 1 from auth.users where id=p_owner and email_confirmed_at is not null) then raise exception 'ACCESS_DENIED';end if;
 perform pg_advisory_xact_lock(hashtextextended('assistant:'||p_owner::text||p_id::text,0));
 select * into saved from assistant_operations where owner=p_owner and key=p_key;
 if found then if saved.thread_id<>p_id then raise exception 'ACCESS_DENIED';end if;return saved.result;end if;
 select * into thread from assistant_threads where owner=p_owner and id=p_id for update;
 if not found or thread.revision<>p_expected then raise exception 'STALE_REVISION';end if;
 proposal:=thread.document->'pending';
 if proposal->'finance' is null or proposal->'finance'='null'::jsonb or proposal is distinct from p_document->'pending' then raise exception 'ACCESS_DENIED';end if;
 if (proposal->'finance'->>'expected')::integer<>p_finance_expected then raise exception 'STALE_REVISION';end if;
 perform pg_advisory_xact_lock(hashtextextended('finance:'||p_owner::text,0));
 select * into ledger from personal_finance where owner=p_owner for update;
 if coalesce(ledger.revision,0)<>p_finance_expected then raise exception 'STALE_REVISION';end if;
 result:=commit_assistant_batch(p_owner,p_id,p_expected,p_key,p_document,p_results);
 insert into personal_finance(owner,revision,state) values(p_owner,p_finance_expected+1,p_finance_state)
 on conflict(owner) do update set revision=excluded.revision,state=excluded.state,updated_at=now();
 insert into personal_finance_audit(owner,revision,proposal_id,commands,state)
 values(p_owner,p_finance_expected+1,proposal->>'id',proposal->'finance'->'commands',p_finance_state);
 return result;
end $$;
revoke all on function public.commit_assistant_finance(uuid,uuid,integer,text,jsonb,jsonb,integer,jsonb) from public,anon,authenticated;
grant execute on function public.commit_assistant_finance(uuid,uuid,integer,text,jsonb,jsonb,integer,jsonb) to service_role;
