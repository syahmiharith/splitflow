-- Append-only history segments share the private conversation's stable identity.
create table public.assistant_segments (
 owner uuid not null, thread_id uuid not null, segment integer not null,
 messages jsonb not null check(jsonb_typeof(messages)='array'),
 created_at timestamptz not null default now(),
 primary key(owner,thread_id,segment),
 foreign key(owner,thread_id) references public.assistant_threads(owner,id) on delete cascade
);
alter table public.assistant_segments enable row level security;
revoke all on public.assistant_segments from public,anon,authenticated;
grant select,insert,delete on public.assistant_segments to service_role;

create or replace function public.save_assistant_thread(p_owner uuid,p_id uuid,p_expected integer,p_key text,p_document jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare prior assistant_threads; saved assistant_operations; v_next jsonb; email text;
 n integer; cutoff integer; linked integer; segment_number integer; archived jsonb; retained jsonb;
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
 if v_next->>'title' is null then
  select v_next||jsonb_build_object('title',left(value->>'text',80)) into retained from jsonb_array_elements(v_next->'messages') where value->>'role'='user' limit 1;
  v_next:=coalesce(retained,v_next);
 end if;
 n:=jsonb_array_length(v_next->'messages');
 if n>=160 and (v_next->'pending' is null or v_next->'pending'='null'::jsonb) then
  cutoff:=n-40;
  -- A result and its original card must remain in the same visible segment.
  select min((m.ordinality-1)::int) into linked
  from jsonb_array_elements(v_next->'messages') with ordinality m(value,ordinality),
       lateral jsonb_array_elements(coalesce(m.value->'parts','[]'::jsonb)) p
  where p->>'type'='review' and exists(
   select 1 from jsonb_array_elements(v_next->'messages') with ordinality r(value,ordinality),
        lateral jsonb_array_elements(coalesce(r.value->'parts','[]'::jsonb)) rp
   where r.ordinality>cutoff and rp->>'type'='result' and rp->>'proposalId'=p->'proposal'->>'id'
  );
  if linked is not null then cutoff:=least(cutoff,linked);end if;
  if cutoff>0 then
   select jsonb_agg(value order by ordinality) filter(where ordinality<=cutoff),jsonb_agg(value order by ordinality) filter(where ordinality>cutoff)
   into archived,retained from jsonb_array_elements(v_next->'messages') with ordinality;
   select coalesce(max(segment),0)+1 into segment_number from assistant_segments where owner=p_owner and thread_id=p_id;
   v_next:=v_next||jsonb_build_object('messages',retained,'historyCount',coalesce((prior.document->>'historyCount')::int,0)+cutoff);
  end if;
 end if;
 insert into assistant_threads(owner,id,revision,document) values(p_owner,p_id,p_expected+1,v_next) on conflict(owner,id) do update set revision=excluded.revision,document=excluded.document,updated_at=now();
 if archived is not null then insert into assistant_segments(owner,thread_id,segment,messages) values(p_owner,p_id,segment_number,archived);end if;
 insert into assistant_operations(owner,thread_id,key,result) values(p_owner,p_id,p_key,v_next);
 return v_next;
end $$;

create function public.read_assistant_history(p_owner uuid,p_id uuid,p_before integer default null,p_query text default '',p_limit integer default 1)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare email text; thread assistant_threads; result jsonb;
begin
 select lower(u.email) into email from auth.users u where u.id=p_owner and email_confirmed_at is not null;
 if email is null then raise exception 'ACCESS_DENIED';end if;
 select * into thread from assistant_threads where owner=p_owner and id=p_id;
 if not found then return jsonb_build_object('segments','[]'::jsonb,'nextBefore',null);end if;
 if thread.document->>'activityId' is not null and not exists(select 1 from activity_records where id=(thread.document->>'activityId')::uuid and email=any(members)) then raise exception 'ACCESS_DENIED';end if;
 if p_limit<1 or p_limit>5 or length(p_query)>200 then raise exception 'INVALID_HISTORY_QUERY';end if;
 with matching as (
  select segment,case when trim(p_query)='' then messages else
   (select jsonb_agg(m) from jsonb_array_elements(messages) m where strpos(lower(m->>'text'),lower(trim(p_query)))>0) end as messages
  from assistant_segments where owner=p_owner and thread_id=p_id and (p_before is null or segment<p_before)
 ), page as (select * from matching where messages is not null order by segment desc limit p_limit+1), chosen as (select * from page order by segment desc limit p_limit)
 select jsonb_build_object('segments',coalesce((select jsonb_agg(jsonb_build_object('index',segment,'messages',messages) order by segment desc) from chosen),'[]'::jsonb),
 'nextBefore',case when (select count(*) from page)>p_limit then (select min(segment) from chosen) else null end) into result;
 return result;
end $$;
revoke all on function public.read_assistant_history(uuid,uuid,integer,text,integer) from public,anon,authenticated;
grant execute on function public.read_assistant_history(uuid,uuid,integer,text,integer) to service_role;
