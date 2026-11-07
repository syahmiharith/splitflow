create table public.pilot_memberships (
 split_id uuid not null references public.pilot_splits(id),
 user_id uuid not null references auth.users(id),
 email text not null,
 role text not null check (role in ('organizer','participant')),
 joined_at timestamptz not null default now(),
 primary key (split_id,user_id),
 unique (split_id,email)
);
create table public.pilot_invitations (
 token_hash text primary key,
 split_id uuid not null references public.pilot_splits(id),
 email text not null,
 issuer uuid not null references auth.users(id),
 expires_at timestamptz not null default now() + interval '7 days',
 redeemed_by uuid references auth.users(id),
 redeemed_at timestamptz
);
alter table public.pilot_memberships enable row level security;
alter table public.pilot_invitations enable row level security;
revoke all on public.pilot_memberships,public.pilot_invitations from anon,authenticated;
grant select on public.pilot_memberships,public.pilot_splits,public.pilot_revisions to authenticated;
grant all on public.pilot_memberships,public.pilot_invitations,public.pilot_splits,public.pilot_revisions,public.pilot_operations to service_role;
create policy own_membership on public.pilot_memberships for select to authenticated using(user_id=auth.uid());
create policy member_split on public.pilot_splits for select to authenticated using(exists(select 1 from public.pilot_memberships m where m.split_id=id and m.user_id=auth.uid()));
create policy member_revision on public.pilot_revisions for select to authenticated using(exists(select 1 from public.pilot_memberships m where m.split_id=pilot_revisions.split_id and m.user_id=auth.uid()));
-- Existing organizers gain membership only through their verified auth account.
insert into public.pilot_memberships(split_id,user_id,email,role)
 select s.id,u.id,lower(u.email),'organizer' from public.pilot_splits s join auth.users u on lower(u.email)=s.document->>'organizer' where u.email_confirmed_at is not null
 on conflict do nothing;

create function public.issue_pilot_invitation(p_split uuid,p_issuer uuid,p_email text,p_hash text)
returns timestamptz language plpgsql security definer set search_path=public as $$
declare expiry timestamptz;
begin
 if not exists(select 1 from pilot_memberships where split_id=p_split and user_id=p_issuer and role='organizer') then raise exception 'ACCESS_DENIED'; end if;
 if not exists(select 1 from pilot_splits s, jsonb_array_elements(s.document->'expense'->'participants') p where s.id=p_split and p->>'email'=p_email) then raise exception 'ACCESS_DENIED'; end if;
 insert into pilot_invitations(token_hash,split_id,email,issuer) values(p_hash,p_split,p_email,p_issuer) on conflict do nothing;
 select expires_at into expiry from pilot_invitations where token_hash=p_hash;
 return expiry;
end $$;
create function public.redeem_pilot_invitation(p_hash text,p_user uuid,p_email text)
returns uuid language plpgsql security definer set search_path=public as $$
declare invitation pilot_invitations;
begin
 select * into invitation from pilot_invitations where token_hash=p_hash for update;
 if not found then raise exception 'INVITATION_EXPIRED'; end if;
 if invitation.email<>p_email then raise exception 'INVITATION_ACCOUNT'; end if;
 if invitation.redeemed_by=p_user then return invitation.split_id; end if;
 if invitation.expires_at<now() or invitation.redeemed_by is not null then raise exception 'INVITATION_EXPIRED'; end if;
 insert into pilot_memberships(split_id,user_id,email,role) values(invitation.split_id,p_user,p_email,'participant') on conflict do nothing;
 update pilot_invitations set redeemed_by=p_user,redeemed_at=now() where token_hash=p_hash;
 return invitation.split_id;
end $$;
create or replace function public.commit_pilot(p_actor uuid,p_key uuid,p_id uuid,p_expected integer,p_document jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare previous jsonb; current_revision integer; actor_email text;
begin
 select lower(email) into actor_email from auth.users where id=p_actor and email_confirmed_at is not null;
 if actor_email is null then raise exception 'ACCESS_DENIED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text || p_key::text,0));
 select result into previous from pilot_operations where actor=p_actor and key=p_key;
 if found then
   if previous->>'id'<>p_id::text then raise exception 'OPERATION_KEY_REUSED'; end if;
   return previous;
 end if;
 if p_expected=0 then
   if p_document->>'organizer'<>actor_email or (p_document->>'revision')::integer<>1 then raise exception 'ACCESS_DENIED'; end if;
   insert into pilot_splits(id,revision,document) values(p_id,1,p_document);
   insert into pilot_memberships(split_id,user_id,email,role) values(p_id,p_actor,actor_email,'organizer');
 else
   if not exists(select 1 from pilot_memberships where split_id=p_id and user_id=p_actor) then raise exception 'ACCESS_DENIED'; end if;
   select revision into current_revision from pilot_splits where id=p_id for update;
   if current_revision is distinct from p_expected or (p_document->>'revision')::integer<>p_expected+1 then raise exception 'STALE_REVISION'; end if;
   update pilot_splits set revision=p_expected+1,document=p_document,updated_at=now() where id=p_id;
 end if;
 insert into pilot_revisions(split_id,revision,document) values(p_id,(p_document->>'revision')::integer,p_document);
 insert into pilot_operations(actor,key,split_id,result) values(p_actor,p_key,p_id,p_document);
 return p_document;
end $$;
revoke all on function public.issue_pilot_invitation(uuid,uuid,text,text),public.redeem_pilot_invitation(text,uuid,text) from public,anon,authenticated;
grant execute on function public.issue_pilot_invitation(uuid,uuid,text,text),public.redeem_pilot_invitation(text,uuid,text) to service_role;
