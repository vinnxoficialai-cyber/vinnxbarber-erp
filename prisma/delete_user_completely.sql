-- ============================================================
-- Migration: Delete auth user + revoke sessions
-- Issue 1: Deleted users still have active auth sessions
-- ============================================================
-- This function deletes a user from auth.users (which also invalidates
-- all their sessions/JWTs) and then cleans up team_members + users tables.
-- Must be SECURITY DEFINER to access auth schema.

-- Drop existing function if any
DROP FUNCTION IF EXISTS delete_user_completely(uuid);

CREATE OR REPLACE FUNCTION delete_user_completely(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_role TEXT;
BEGIN
    -- Security: Only admins can delete users
    SELECT role INTO caller_role FROM users WHERE id = auth.uid()::text;
    IF caller_role IS NULL OR caller_role != 'ADMIN' THEN
        RAISE EXCEPTION 'Only admins can delete users';
    END IF;

    -- 1. Delete from team_members first (FK constraint: team_members.userId -> users.id)
    DELETE FROM team_members WHERE "userId" = target_user_id::text;
    
    -- 2. Delete from users table
    DELETE FROM users WHERE id = target_user_id::text;
    
    -- 3. Delete from auth.users (this invalidates ALL sessions/JWTs for this user)
    DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

-- Grant execute to authenticated users (only admins will call this from frontend)
GRANT EXECUTE ON FUNCTION delete_user_completely(uuid) TO authenticated;
