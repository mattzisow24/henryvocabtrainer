-- Flashcard rounds are logged as reviews with their own source.
alter table reviews drop constraint if exists reviews_source_check;
alter table reviews add constraint reviews_source_check check (source in ('coach', 'drill', 'sort', 'cards'));
