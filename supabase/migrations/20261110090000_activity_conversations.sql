-- A private, stable conversation destination for each member of an activity.
create table public.activity_conversations (
 owner uuid not null references auth.users(id) on delete cascade,
 activity_id uuid not null references public.activity_records(id) on delete cascade,
 thread_id uuid not null,
 primary key(owner,activity_id),
 foreign key(owner,thread_id) references public.assistant_threads(owner,id) on delete cascade
);
alter table public.activity_conversations enable row level security;
revoke all on public.activity_conversations from public,anon,authenticated;
grant all on public.activity_conversations to service_role;
create function public.resolve_activity_conversation(p_owner uuid,p_activity uuid)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare email text; chosen uuid; doc jsonb;
begin
 select lower(u.email) into email from auth.users u where u.id=p_owner and email_confirmed_at is not null;
 if email is null or not exists(select 1 from activity_records where id=p_activity and kind='activity' and email=any(members)) then raise exception 'ACCESS_DENIED';end if;
 perform pg_advisory_xact_lock(hashtextextended('activity-conversation:'||p_owner::text||p_activity::text,0));
 select thread_id into chosen from activity_conversations where owner=p_owner and activity_id=p_activity;
 if chosen is null then
  select id into chosen from assistant_threads where owner=p_owner and document->>'activityId'=p_activity::text order by updated_at desc,id asc limit 1;
  if chosen is null then
   chosen:=gen_random_uuid();
   doc:=jsonb_build_object('id',chosen,'revision',0,'activityId',p_activity,'messages','[]'::jsonb,'status','idle','pending',null,'draft',null,'updatedAt',now());
   insert into assistant_threads(owner,id,revision,document) values(p_owner,chosen,0,doc);
  end if;
  insert into activity_conversations(owner,activity_id,thread_id) values(p_owner,p_activity,chosen);
 end if;
 select document into doc from assistant_threads where owner=p_owner and id=chosen;
 return doc;
end $$;
revoke all on function public.resolve_activity_conversation(uuid,uuid) from public,anon,authenticated;
grant execute on function public.resolve_activity_conversation(uuid,uuid) to service_role;
