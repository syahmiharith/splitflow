begin;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); stranger uuid:=gen_random_uuid(); activity uuid:=gen_random_uuid(); first jsonb; again jsonb; other jsonb; legacy uuid:=gen_random_uuid();
begin
 insert into auth.users(id,email,email_confirmed_at) values(a,'mapping-a@example.test',now()),(b,'mapping-b@example.test',now()),(stranger,'mapping-c@example.test',now());
 insert into activity_records(id,kind,revision,members,document) values(activity,'activity',1,array['mapping-a@example.test','mapping-b@example.test'],jsonb_build_object('id',activity,'revision',1));
 set local role service_role;
 first:=resolve_activity_conversation(a,activity);
 again:=resolve_activity_conversation(a,activity);
 insert into assistant_threads(owner,id,revision,document,updated_at) values(b,legacy,0,jsonb_build_object('id',legacy,'activityId',activity,'revision',0,'messages','[]'::jsonb),now());
 other:=resolve_activity_conversation(b,activity);
 if other->>'id'<>legacy::text then raise exception 'Legacy thread was not preserved';end if;
 if first->>'id'<>again->>'id' or first->>'id'=other->>'id' then raise exception 'Private mapping is unstable';end if;
 if (select count(*) from activity_conversations where activity_id=activity)<>2 then raise exception 'Duplicate mapping';end if;
 begin
  perform resolve_activity_conversation(stranger,activity);
  raise exception 'Stranger resolved conversation';
 exception when raise_exception then if sqlerrm<>'ACCESS_DENIED' then raise;end if;end;
 update activity_records set members=array['mapping-b@example.test'] where id=activity;
 begin
  perform resolve_activity_conversation(a,activity);
  raise exception 'Revoked member resolved conversation';
 exception when raise_exception then if sqlerrm<>'ACCESS_DENIED' then raise;end if;end;
 reset role;
end $$;
set local role authenticated;
do $$ begin
 begin
  perform resolve_activity_conversation(gen_random_uuid(),gen_random_uuid());
  raise exception 'Browser invoked private resolver';
 exception when insufficient_privilege then null;end;
end $$;
rollback;
