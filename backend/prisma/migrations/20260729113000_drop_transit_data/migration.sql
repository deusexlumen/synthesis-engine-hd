-- Drop the dead TransitData table: nothing in the codebase ever read or
-- wrote it (daily transits are computed on demand by the ephemeris service).
DROP TABLE "TransitData";
