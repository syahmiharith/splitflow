-- Run against an isolated database with migrations applied. Synthetic fixtures roll back.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('10000000-0000-4000-8000-000000000001','organizer@example.com',now()),
 ('10000000-0000-4000-8000-000000000002','guest@example.com',now()),
 ('10000000-0000-4000-8000-000000000003','stranger@example.com',now());
do $$
declare doc jsonb; first_result jsonb; replay jsonb; expiry timestamptz; joined uuid;
begin
 doc='{"id":"20000000-0000-4000-8000-000000000001","organizer":"organizer@example.com","revision":1,"expense":{"participants":[{"email":"organizer@example.com"},{"email":"guest@example.com"}]}}';
 first_result=public.commit_pilot('10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',0,doc);
 replay=public.commit_pilot('10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',0,doc);
 if replay<>first_result or (select count(*) from pilot_revisions)<>1 then raise exception 'duplicate submission created a second revision'; end if;
 begin
  perform public.commit_pilot('10000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001',1,jsonb_set(doc,'{revision}','2'));
  raise exception 'unredeemed participant gained access';
 exception when raise_exception then if sqlerrm<>'ACCESS_DENIED' then raise; end if; end;
 expiry=public.issue_pilot_invitation('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','guest@example.com','test-token-hash');
 begin
  perform public.redeem_pilot_invitation('test-token-hash','10000000-0000-4000-8000-000000000003','stranger@example.com');
  raise exception 'wrong account redeemed invitation';
 exception when raise_exception then if sqlerrm<>'INVITATION_ACCOUNT' then raise; end if; end;
 update pilot_invitations set expires_at=now()-interval '1 minute' where token_hash='test-token-hash';
 begin
  perform public.redeem_pilot_invitation('test-token-hash','10000000-0000-4000-8000-000000000002','guest@example.com');
  raise exception 'expired invitation redeemed';
 exception when raise_exception then if sqlerrm<>'INVITATION_EXPIRED' then raise; end if; end;
 update pilot_invitations set expires_at=expiry where token_hash='test-token-hash';
 joined=public.redeem_pilot_invitation('test-token-hash','10000000-0000-4000-8000-000000000002','guest@example.com');
 if joined<>'20000000-0000-4000-8000-000000000001'::uuid then raise exception 'wrong split'; end if;
 perform public.redeem_pilot_invitation('test-token-hash','10000000-0000-4000-8000-000000000002','guest@example.com');
 if (select count(*) from pilot_memberships)<>2 then raise exception 'duplicate membership'; end if;
 perform public.commit_pilot('10000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001',1,jsonb_set(doc,'{revision}','2'));
 begin
  perform public.commit_pilot('10000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001',1,jsonb_set(doc,'{revision}','2'));
  raise exception 'stale write accepted';
 exception when raise_exception then if sqlerrm<>'STALE_REVISION' then raise; end if; end;
 if (select count(*) from pilot_revisions)<>2 or (select count(*) from pilot_operations)<>2 then raise exception 'failed write left partial state'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
do $$ begin
 if exists(select 1 from public.pilot_splits) then raise exception 'RLS exposed a split to a stranger'; end if;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$ begin
 if (select count(*) from public.pilot_splits)<>1 then raise exception 'member read failed'; end if;
 begin
  perform public.commit_pilot('10000000-0000-4000-8000-000000000002',gen_random_uuid(),'20000000-0000-4000-8000-000000000001',2,'{}');
  raise exception 'browser executed service RPC';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
