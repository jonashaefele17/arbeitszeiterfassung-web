-- V2 – Etappe 6: Einwilligung und Konto löschen
--
-- * Die Einwilligung zur Speicherung von Krankheitstagen wird am Konto festgehalten
--   (account_status), nicht am Profil – sie gilt vor dem ersten Datensatz.
-- * Nutzer können ihr Konto samt aller Daten selbst löschen (DSGVO: Recht auf Löschung).

alter table public.account_status add column health_data_consent_at timestamptz;

-- Nicht genutzt: die Einwilligung liegt am Konto.
alter table public.profiles drop column health_data_consent_at;

-- Einwilligung der angemeldeten Person festhalten (Zeitpunkt = Serverzeit).
create function public.give_health_data_consent()
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.account_status (user_id, must_change_password, health_data_consent_at, updated_at)
  values ((select auth.uid()), false, now(), now())
  on conflict (user_id) do update
    set health_data_consent_at = now(), updated_at = now()
$$;

-- Eigenes Konto endgültig löschen. Alle Daten hängen per ON DELETE CASCADE am Konto.
create function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = (select auth.uid());
end;
$$;

revoke all on function public.give_health_data_consent() from public, anon;
revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.give_health_data_consent() to authenticated;
grant execute on function public.delete_own_account() to authenticated;
