begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('81000000-0000-4000-8000-000000000001','friend-alex@example.test',now()),
 ('81000000-0000-4000-8000-000000000002','friend-minji@example.test',now());
do $$
declare a uuid:='81000000-0000-4000-8000-000000000001'; b uuid:='81000000-0000-4000-8000-000000000002';
 f uuid:='82000000-0000-4000-8000-000000000001'; act uuid:='82000000-0000-4000-8000-000000000002';
 doc jsonb; activity jsonb; result jsonb;
begin
 doc:=jsonb_build_object('id',f,'revision',1,'owner','friend-alex@example.test','name','Friend request','friendship',true,
  'people','[{"name":"Alex","email":"friend-alex@example.test"},{"name":"Minji","email":"friend-minji@example.test"}]'::jsonb,
  'joined','["friend-alex@example.test"]'::jsonb,'invitations','{}'::jsonb);
 perform commit_activity(a,gen_random_uuid(),f,'group',0,doc);
 activity:=jsonb_build_object('id',act,'revision',1,'owner','friend-alex@example.test','title','Dinner','kind','quick',
  'people',doc->'people','expenses','[]'::jsonb,'messages','[]'::jsonb,'archivedBy','[]'::jsonb);
 begin
  perform commit_activity(a,gen_random_uuid(),act,'activity',0,activity);
  raise exception 'one-way friendship allowed sharing';
 exception when raise_exception then if sqlerrm<>'MUTUAL_FRIENDSHIP_REQUIRED' then raise;end if;end;
 doc:=jsonb_set(jsonb_set(doc,'{revision}','2'),'{joined}','["friend-alex@example.test","friend-minji@example.test"]');
 begin
  perform commit_activity(a,gen_random_uuid(),f,'group',1,doc);
  raise exception 'forged other consent';
 exception when raise_exception then if sqlerrm<>'FRIEND_CONSENT_REQUIRED' then raise;end if;end;
 perform commit_activity(b,gen_random_uuid(),f,'group',1,doc);
 perform commit_activity(a,gen_random_uuid(),act,'activity',0,activity);
 begin
  perform commit_activity(a,gen_random_uuid(),gen_random_uuid(),'group',0,
   jsonb_set(jsonb_set(jsonb_set(doc,'{id}',to_jsonb(gen_random_uuid())),'{revision}','1'),'{joined}','["friend-alex@example.test"]'));
  raise exception 'wrong id allowed';
 exception when raise_exception then if sqlerrm<>'STALE_REVISION' then raise;end if;end;
 -- A second id for this same pair must not create competing consent histories.
 declare duplicate_id uuid:=gen_random_uuid();begin
  perform commit_activity(a,gen_random_uuid(),duplicate_id,'group',0,
   jsonb_set(jsonb_set(jsonb_set(doc,'{id}',to_jsonb(duplicate_id)),'{revision}','1'),'{joined}','["friend-alex@example.test"]'));
  raise exception 'duplicate friendship accepted';
 exception when unique_violation then null;end;
 doc:=jsonb_set(jsonb_set(doc,'{revision}','3'),'{joined}','["friend-minji@example.test"]');
 perform commit_activity(a,gen_random_uuid(),f,'group',2,doc);
 -- Existing records remain readable and non-financial updates are allowed.
 activity:=jsonb_set(jsonb_set(activity,'{revision}','2'),'{archivedBy}','["friend-alex@example.test"]');
 perform commit_activity(a,gen_random_uuid(),act,'activity',1,activity);
 begin
  perform assert_mutual_friendships('friend-alex@example.test',array['friend-minji@example.test']);
  raise exception 'revoked friendship accepted';
 exception when raise_exception then if sqlerrm<>'MUTUAL_FRIENDSHIP_REQUIRED' then raise;end if;end;
 -- Revocation also blocks adding claims to an already shared activity.
 begin
  perform commit_activity(a,gen_random_uuid(),act,'activity',2,
   jsonb_set(jsonb_set(activity,'{revision}','3'),'{expenses}',jsonb_build_array(
    jsonb_build_object('id',gen_random_uuid(),'expense',jsonb_build_object('participants',activity->'people')))));
  raise exception 'new claim after revocation accepted';
 exception when raise_exception then if sqlerrm<>'MUTUAL_FRIENDSHIP_REQUIRED' then raise;end if;end;
 begin
  perform commit_activity(a,gen_random_uuid(),act,'activity',2,jsonb_set(jsonb_set(activity,'{revision}','3'),'{messages}',
   '[{"id":"message","actor":"friend-alex@example.test","kind":"message","text":"direct message"}]'));
  raise exception 'direct message accepted';
 exception when raise_exception then if sqlerrm<>'DIRECT_MESSAGES_DISABLED' then raise;end if;end;
 -- Compatibility route also requires mutual friendship for new expense claims.
 begin
  perform commit_pilot(a,gen_random_uuid(),gen_random_uuid(),0,jsonb_build_object('revision',1,'organizer','friend-alex@example.test','expense',jsonb_build_object('participants',activity->'people')));
  raise exception 'legacy bypass accepted';
 exception when raise_exception then if sqlerrm<>'MUTUAL_FRIENDSHIP_REQUIRED' then raise;end if;end;
end $$;
rollback;
