begin;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); id uuid:=gen_random_uuid(); activity uuid:=gen_random_uuid(); doc jsonb; saved jsonb; replay jsonb; page jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at) values(a,'segments-a@example.test',now()),(b,'segments-b@example.test',now());
 insert into activity_records(id,kind,revision,members,document) values(activity,'activity',1,array['segments-a@example.test'],jsonb_build_object('id',activity,'revision',1));
 select jsonb_build_object('id',id,'activityId',activity,'messages',jsonb_agg(jsonb_build_object('id',i::text,'role','user','text','Message '||i,'at','2026-11-10T00:00:00Z') order by i),'pending',null,'status','idle') into doc from generate_series(1,160) i;
 set local role service_role;
 saved:=save_assistant_thread(a,id,0,'first',doc);
 if jsonb_array_length(saved->'messages')<>40 or (saved->>'historyCount')::int<>120 then raise exception 'Incorrect compaction';end if;
 replay:=save_assistant_thread(a,id,0,'first',doc);
 if replay<>saved or (select count(*) from assistant_segments where owner=a and thread_id=id)<>1 then raise exception 'Retry duplicated segment';end if;
 begin
  perform save_assistant_thread(a,id,0,'stale',doc);
  raise exception 'Stale write accepted';
 exception when raise_exception then if sqlerrm<>'STALE_REVISION' then raise;end if;end;
 page:=read_assistant_history(a,id,null,'Message 12',1);
 if jsonb_array_length(page->'segments')<>1 then raise exception 'Missing history search';end if;
 if jsonb_array_length(read_assistant_history(b,id)->'segments')<>0 then raise exception 'Private history leaked';end if;
 update activity_records set members=array[]::text[] where activity_records.id=activity;
 begin
  perform read_assistant_history(a,id);
  raise exception 'Revoked member read history';
 exception when raise_exception then if sqlerrm<>'ACCESS_DENIED' then raise;end if;end;
 reset role;
end $$;
set local role authenticated;
do $$ begin
 begin
  perform read_assistant_history(gen_random_uuid(),gen_random_uuid());
  raise exception 'Browser invoked history reader';
 exception when insufficient_privilege then null;end;
end $$;
rollback;
