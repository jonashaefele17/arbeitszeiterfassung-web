-- V2 – Etappe 7: Schutz gegen das Pausieren im Free Tier
--
-- Gratis-Projekte werden nach ca. 1 Woche ohne Aktivität pausiert. Ein täglicher Aufruf
-- dieser Funktion (GitHub Action .github/workflows/keep-alive.yml) hält das Projekt aktiv.
-- Sie liest keine Daten und ist daher auch ohne Anmeldung aufrufbar.

create function public.keep_alive()
returns integer
language sql
stable
set search_path = ''
as $$
  select 1
$$;

revoke all on function public.keep_alive() from public;
grant execute on function public.keep_alive() to anon, authenticated;
