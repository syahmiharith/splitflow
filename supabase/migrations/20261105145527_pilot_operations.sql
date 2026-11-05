DROP POLICY "own_membership" ON "public"."pilot_memberships";

DROP POLICY "member_revision" ON "public"."pilot_revisions";

DROP POLICY "member_split" ON "public"."pilot_splits";

CREATE TABLE "public"."pilot_creation_measurements" (
  "user_id"      uuid                     NOT NULL,
  "id"           uuid                     NOT NULL,
  "started_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "published_at" timestamp with time zone,
  "split_id"     uuid,
  "used_ai"      boolean                  NOT NULL DEFAULT false,
  CONSTRAINT "pilot_creation_measurements_pkey" PRIMARY KEY (user_id, id)
);

ALTER TABLE "public"."pilot_creation_measurements"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."pilot_creation_measurements" FROM "anon", "authenticated";

CREATE TABLE "public"."pilot_feedback" (
  "user_id"     uuid                     NOT NULL,
  "id"          uuid                     NOT NULL,
  "split_id"    uuid,
  "expected"    text                     NOT NULL,
  "actual"      text                     NOT NULL,
  "app_version" text                     NOT NULL,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "pilot_feedback_actual_check" CHECK (((length(actual) >= 1) AND (length(actual) <= 1000))),
  CONSTRAINT "pilot_feedback_expected_check" CHECK (((length(expected) >= 1) AND (length(expected) <= 1000))),
  CONSTRAINT "pilot_feedback_pkey" PRIMARY KEY (user_id, id)
);

ALTER TABLE "public"."pilot_feedback"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."pilot_feedback" FROM "anon";

ALTER TABLE "public"."pilot_creation_measurements"
  ADD CONSTRAINT "pilot_creation_measurements_split_id_fkey" FOREIGN KEY (split_id) REFERENCES public.pilot_splits(id);

ALTER TABLE "public"."pilot_creation_measurements"
  ADD CONSTRAINT "pilot_creation_measurements_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE "public"."pilot_feedback"
  ADD CONSTRAINT "pilot_feedback_split_id_fkey" FOREIGN KEY (split_id) REFERENCES public.pilot_splits(id);

ALTER TABLE "public"."pilot_feedback"
  ADD CONSTRAINT "pilot_feedback_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

CREATE INDEX pilot_feedback_split_idx ON public.pilot_feedback USING btree (split_id);

CREATE INDEX pilot_invitations_issuer_idx ON public.pilot_invitations USING btree (issuer);

CREATE INDEX pilot_invitations_redeemed_idx ON public.pilot_invitations USING btree (redeemed_by);

CREATE INDEX pilot_invitations_split_idx ON public.pilot_invitations USING btree (split_id);

CREATE INDEX pilot_measurements_split_idx ON public.pilot_creation_measurements USING btree (split_id);

CREATE INDEX pilot_memberships_user_idx ON public.pilot_memberships USING btree (user_id);

CREATE INDEX pilot_operations_split_idx ON public.pilot_operations USING btree (split_id);

CREATE POLICY "own_feedback" ON "public"."pilot_feedback"
  FOR SELECT
  TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "own_membership" ON "public"."pilot_memberships"
  FOR SELECT
  TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "member_revision" ON "public"."pilot_revisions"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.pilot_memberships m
  WHERE ((m.split_id = pilot_revisions.split_id) AND (m.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "member_split" ON "public"."pilot_splits"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.pilot_memberships m
  WHERE ((m.split_id = pilot_splits.id) AND (m.user_id = ( SELECT auth.uid() AS uid))))));

REVOKE ALL ON TABLE "public"."pilot_creation_measurements" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."pilot_creation_measurements" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."pilot_creation_measurements" TO "service_role";

REVOKE ALL ON TABLE "public"."pilot_feedback" FROM "authenticated";

GRANT SELECT ON TABLE "public"."pilot_feedback" TO "authenticated";

REVOKE ALL ON TABLE "public"."pilot_feedback" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."pilot_feedback" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."pilot_feedback" TO "service_role";
