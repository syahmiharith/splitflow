begin;
do $$
declare a uuid:=gen_random_uuid(); id uuid:=gen_random_uuid(); group_id uuid:=gen_random_uuid(); doc jsonb; saved jsonb; proposal jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at) values(a,'notify-a@example.test',now());
 insert into activity_records(id,kind,revision,members,document) values(group_id,'group',1,array['notify-a@example.test','notify-b@example.test'],jsonb_build_object('id',group_id,'owner','notify-a@example.test','people',jsonb_build_array(jsonb_build_object('email','notify-a@example.test'),jsonb_build_object('email','notify-b@example.test')),'joined',jsonb_build_array('notify-a@example.test'),'invitations',jsonb_build_object('notify-b@example.test',now()+interval '7 days')));
 proposal:=jsonb_build_object('id',gen_random_uuid(),'operations','[]'::jsonb,'dependencies','[]'::jsonb,'previews','[]'::jsonb,'notifications',jsonb_build_object('commands',jsonb_build_array(jsonb_build_object('recordId',group_id,'expenseId',null,'expected',0,'enabled',true,'muted',false,'stopped',false,'snoozedUntil',null,'dueAt',null))));
 doc:=jsonb_build_object('id',id,'activityId',null,'messages','[]'::jsonb,'pending',proposal,'status','idle');
 set local role service_role;
 saved:=save_assistant_thread(a,id,0,'review',doc);
 perform commit_assistant_notifications(a,id,1,'confirm',saved,'[]'::jsonb);
 perform commit_assistant_notifications(a,id,1,'confirm',saved,'[]'::jsonb);
 if (select count(*) from notification_preferences where owner=a)<>1 then raise exception 'Preference duplicated';end if;
 perform schedule_notification_reminders();perform schedule_notification_reminders();
 if (select count(*) from notification_outbox where record_id=group_id and kind='reminder')<>2 then raise exception 'Reminders duplicated';end if;
 if (select count(*) from notification_outbox where record_id=group_id and kind='invitation')<>1 then raise exception 'Invitation missing';end if;
 reset role;
end $$;
set local role authenticated;
do $$ begin
 begin perform 1 from notification_preferences;raise exception 'Browser read preferences';exception when insufficient_privilege then null;end;
 begin perform schedule_notification_reminders();raise exception 'Browser scheduled reminders';exception when insufficient_privilege then null;end;
end $$;
rollback;
