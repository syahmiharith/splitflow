-- Synthetic owner, replay and stale-write checks; no fixture survives this transaction.
begin;
insert into auth.users(id,email) values('41000000-0000-4000-8000-000000000001','group-owner@example.test'),('41000000-0000-4000-8000-000000000002','group-stranger@example.test');
do $$
declare doc jsonb; saved jsonb; replay jsonb;
begin
 doc='{"id":"51000000-0000-4000-8000-000000000001","revision":1,"name":"Dinner friends","people":[]}';
 saved=public.save_pilot_group('41000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001',0,doc);
 replay=public.save_pilot_group('41000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001',0,doc);
 if saved<>replay or (select count(*) from pilot_groups where id='51000000-0000-4000-8000-000000000001')<>1 then raise exception 'duplicate group'; end if;
 begin
  perform public.save_pilot_group('41000000-0000-4000-8000-000000000002','61000000-0000-4000-8000-000000000002',1,jsonb_set(doc,'{revision}','2'));
  raise exception 'stranger overwrote group';
 exception when raise_exception then if sqlerrm<>'ACCESS_DENIED' then raise; end if; end;
 perform public.save_pilot_group('41000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000003',1,jsonb_set(doc,'{revision}','2'));
 begin
  perform public.save_pilot_group('41000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000004',1,jsonb_set(doc,'{revision}','2'));
  raise exception 'stale group accepted';
 exception when raise_exception then if sqlerrm<>'STALE_REVISION' then raise; end if; end;
 if (select count(*) from pilot_group_operations where owner='41000000-0000-4000-8000-000000000001')<>2 then raise exception 'partial operation'; end if;
end $$;
set local role authenticated;
do $$ begin
 begin
  perform public.save_pilot_group('41000000-0000-4000-8000-000000000001',gen_random_uuid(),0,'{}');
  raise exception 'browser called group service RPC';
 exception when insufficient_privilege then null; end;
 begin
  perform 1 from public.pilot_groups;
  raise exception 'direct browser access granted';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
