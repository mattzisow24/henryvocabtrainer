-- Brings a database created from an older copy of 001_init.sql (for example
-- the SSAT trainer's) in line with this app. Safe to run on any database:
-- every statement is a no-op when the schema is already current.
alter table sessions drop column if exists kind;
alter table drill_runs drop column if exists kind;
alter table reviews drop constraint if exists reviews_source_check;
alter table reviews add constraint reviews_source_check check (source in ('coach', 'drill', 'sort', 'cards'));
