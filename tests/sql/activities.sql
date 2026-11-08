begin;
insert into auth.users(id,email,email_confirmed_at) values('71000000-0000-4000-8000-000000000001','alex@example.test',now()),('71000000-0000-4000-8000-000000000002','stranger@example.test',now());
do $$
declare doc jsonb;result jsonb;total int;
begin
 doc:='{"id":"72000000-0000-4000-8000-000000000001","revision":1,"owner":"alex@example.test","title":"Rent","kind":"recurring","people":[{"email":"alex@example.test","name":"Alex"},{"email":"bo@example.test","name":"Bo"}],"expenses":[],"messages":[],"archivedBy":[],"schedule":{"version":1,"start":"2026-01-31","dueDay":5,"variable":false,"paused":false,"accepted":["alex@example.test"],"expense":{"title":"Rent","mode":"paid","participants":[{"email":"alex@example.test","name":"Alex","paid":900000},{"email":"bo@example.test","name":"Bo","paid":0}],"items":[{"name":"Rent","amount":900000,"included":["alex@example.test","bo@example.test"]}]}}}';
 perform commit_activity('71000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001','activity',0,doc);
 perform publish_recurring_activity_periods('2026-03-31');
 select document into result from activity_records where id='72000000-0000-4000-8000-000000000001';
 if jsonb_array_length(result->'expenses')<>0 then raise exception 'published without consent';end if;
 doc:=jsonb_set(jsonb_set(doc,'{revision}','2'),'{schedule,accepted}','["alex@example.test","bo@example.test"]');
 perform commit_activity('71000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000002','72000000-0000-4000-8000-000000000001','activity',1,doc);
 perform publish_recurring_activity_periods('2026-03-31');perform publish_recurring_activity_periods('2026-03-31');
 select document into result from activity_records where id='72000000-0000-4000-8000-000000000001';
 if jsonb_array_length(result->'expenses')<>3 then raise exception 'duplicate or missing periods';end if;
 if result->'expenses'->1->>'period'<>'2026-02' then raise exception 'month boundary';end if;
 if result->'expenses'->0->'expense'->>'mode'<>'planned' then raise exception 'fabricated payment';end if;
 if result->'expenses'->0->>'dueDate'<>'2026-02-05' then raise exception 'incorrect due date';end if;
 update activity_records set document=jsonb_set(document,'{schedule,resumeFrom}','"2026-05-01"') where id='72000000-0000-4000-8000-000000000001';
 perform publish_recurring_activity_periods('2026-04-30');
 select document into result from activity_records where id='72000000-0000-4000-8000-000000000001';
 if jsonb_array_length(result->'expenses')<>3 then raise exception 'backfilled a paused period';end if;
 begin
  perform commit_activity('71000000-0000-4000-8000-000000000002',gen_random_uuid(),'72000000-0000-4000-8000-000000000001','activity',3,jsonb_set(result,'{revision}','4'));
  raise exception 'unauthorized mutation';
 exception when raise_exception then if sqlerrm<>'ACCESS_DENIED' then raise;end if;end;
 begin
  perform commit_activity('71000000-0000-4000-8000-000000000001',gen_random_uuid(),'72000000-0000-4000-8000-000000000001','activity',1,doc);
  raise exception 'stale mutation';
 exception when raise_exception then if sqlerrm<>'STALE_REVISION' then raise;end if;end;
end $$;
set local role authenticated;
do $$ begin
 begin perform 1 from activity_records;raise exception 'browser read';exception when insufficient_privilege then null;end;
 begin perform publish_recurring_activity_periods('2026-04-30');raise exception 'browser scheduled';exception when insufficient_privilege then null;end;
end $$;
rollback;
