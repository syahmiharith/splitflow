-- The service role cannot read auth.users. Definer is required for the confirmed
-- identity check; execute remains revoked from all browser roles.
alter function public.resolve_activity_conversation(uuid,uuid) security definer;
