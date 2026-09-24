-- Student-facing rental taxonomy: specific room, unit-size and floor offers that
-- Cambodian students actually compare (1/2/3 bedroom, shared room, floor 1-3).
-- The earlier generic values stay in place so existing published listings and
-- saved filters keep working; this migration only widens the type.
ALTER TYPE "property_type" ADD VALUE IF NOT EXISTS 'one_bedroom';
ALTER TYPE "property_type" ADD VALUE IF NOT EXISTS 'two_bedroom';
ALTER TYPE "property_type" ADD VALUE IF NOT EXISTS 'three_bedroom';
ALTER TYPE "property_type" ADD VALUE IF NOT EXISTS 'shared_room';
ALTER TYPE "property_type" ADD VALUE IF NOT EXISTS 'floor_1';
ALTER TYPE "property_type" ADD VALUE IF NOT EXISTS 'floor_2';
ALTER TYPE "property_type" ADD VALUE IF NOT EXISTS 'floor_3';
