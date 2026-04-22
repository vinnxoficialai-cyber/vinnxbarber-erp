-- =====================================================
-- Fix barberName stored as UUID in calendar_events
-- 
-- Some older events were saved with the barber's user ID
-- instead of their display name. This updates them using
-- the users table (where barberId FK points to).
--
-- IMPORTANT: barberId references users.id (TEXT), not
-- team_members.id. The name field lives on users.
-- =====================================================

UPDATE calendar_events ce
SET "barberName" = u."name"
FROM users u
WHERE ce."barberId" = u."id"
  AND ce."barberName" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-';
