begin;
do $$
declare a uuid:=gen_random_uuid(); id uuid:=gen_random_uuid(); proposal jsonb; doc jsonb; saved jsonb; committed jsonb; ledger jsonb:='{"accounts":[],"transactions":[]}'::jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at) values(a,'finance-a@example.test',now());
 proposal:=jsonb_build_object('id',gen_random_uuid(),'operations','[]'::jsonb,'dependencies','[]'::jsonb,'previews','[]'::jsonb,'finance',jsonb_build_object('expected',0,'commands','[]'::jsonb));
 doc:=jsonb_build_object('id',id,'activityId',null,'messages','[]'::jsonb,'pending',proposal,'status','idle');
 set local role service_role;
 saved:=save_assistant_thread(a,id,0,'review',doc);
 committed:=commit_assistant_finance(a,id,1,'commit',saved,'[]'::jsonb,0,ledger);
 if (select revision from personal_finance where owner=a)<>1 then raise exception 'Finance missing';end if;
 if commit_assistant_finance(a,id,1,'commit',saved,'[]'::jsonb,0,ledger)<>committed then raise exception 'Lost response not replayed';end if;
 if (select count(*) from personal_finance_audit where owner=a)<>1 then raise exception 'Duplicate ledger mutation';end if;
 saved:=save_assistant_thread(a,id,2,'review2',saved);
 begin
  perform commit_assistant_finance(a,id,3,'commit2',saved,'[]'::jsonb,0,ledger);
  raise exception 'Stale ledger accepted';
 exception when raise_exception then if sqlerrm<>'STALE_REVISION' then raise;end if;end;
 if (select count(*) from assistant_operations where owner=a and key='commit2')<>0 then raise exception 'Failed commit persisted';end if;
 reset role;
end $$;
set local role authenticated;
do $$ begin
 begin perform 1 from personal_finance;raise exception 'Browser read private ledger';exception when insufficient_privilege then null;end;
 begin perform 1 from personal_finance_audit;raise exception 'Browser read private audit';exception when insufficient_privilege then null;end;
end $$;
rollback;
