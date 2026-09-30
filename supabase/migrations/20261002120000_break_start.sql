-- Pausenbeginn: exakte Pausenzeit (z. B. 12:30–13:00) für den Nachweis.
-- Die Berechnung nutzt weiterhin nur die Pausendauer. Ältere Einträge haben keinen Pausenbeginn.
alter table public.work_days
  add column break_start text check (break_start is null or break_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
