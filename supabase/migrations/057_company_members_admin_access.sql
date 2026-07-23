-- Usuários e acessos: Admin lista membros da empresa e altera papel
-- Espelho: frontend/scripts/apply-057-company-members-admin-access.sql

DROP POLICY IF EXISTS company_members_select_own ON public.company_members;
DROP POLICY IF EXISTS company_members_select ON public.company_members;
CREATE POLICY company_members_select ON public.company_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.auth_user_is_company_admin(company_id)
  );

DROP POLICY IF EXISTS company_members_update_admin ON public.company_members;
CREATE POLICY company_members_update_admin ON public.company_members
  FOR UPDATE TO authenticated
  USING (public.auth_user_is_company_admin(company_id))
  WITH CHECK (public.auth_user_is_company_admin(company_id));

DROP POLICY IF EXISTS company_members_insert_own ON public.company_members;
DROP POLICY IF EXISTS company_members_insert ON public.company_members;
CREATE POLICY company_members_insert ON public.company_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.auth_user_is_company_admin(company_id)
  );

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.company_members me
      INNER JOIN public.company_members other
        ON other.company_id = me.company_id
       AND other.user_id = profiles.id
      WHERE me.user_id = auth.uid()
        AND me.role = 'admin'
    )
  );

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

COMMENT ON POLICY company_members_update_admin ON public.company_members IS
  'Admin da empresa pode promover/rebaixar papéis (ex.: substituto nas férias).';
