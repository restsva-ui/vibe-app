-- Membership revocation also revokes outstanding calendar downloads and reminders.
create function public.vybe_plan_growth_revoke() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.status<>'approved' and old.status='approved' then
    update public.vybe_plan_reminders set enabled=false where plan_id=new.plan_id and user_id=new.user_id;
    update public.vybe_plan_calendar_tokens set token=gen_random_uuid() where plan_id=new.plan_id and user_id=new.user_id;
  end if;
  return new;
end;
$$;
revoke all on function public.vybe_plan_growth_revoke() from public,anon,authenticated;
grant execute on function public.vybe_plan_growth_revoke() to service_role;
create trigger vybe_plan_growth_membership after update of status on public.vybe_plan_applications for each row execute function public.vybe_plan_growth_revoke();

create extension if not exists pg_net with schema extensions;
-- Raw worker credential stays in Vault. The service API can only compare its SHA-256 hash.
do $$
declare v_secret text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name='vybe_plan_reminder_worker' limit 1;
  if v_secret is null then
    v_secret:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
    perform vault.create_secret(v_secret,'vybe_plan_reminder_worker','Internal authorization for user-enabled VYBE plan reminders');
  end if;
  insert into public.vybe_plan_worker_auth(singleton,secret_hash) values(true,encode(sha256(convert_to(v_secret,'UTF8')),'hex'))
    on conflict(singleton) do update set secret_hash=excluded.secret_hash;
end;
$$;
-- No periodic HTTP requests without an eligible, explicitly enabled reminder.
select cron.schedule('vybe-plan-reminders','* * * * *',$job$
  select net.http_post(
    url:='https://qifxxzpnuxchnkowxzgp.supabase.co/functions/v1/plan-invite',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='vybe_plan_reminder_worker' limit 1)),
    body:='{}'::jsonb,timeout_milliseconds:=20000)
  where exists(select 1 from public.vybe_plan_reminders r join public.vybe_plans p on p.id=r.plan_id
    where r.enabled and r.due_at<=now() and r.push_status in ('pending','retry') and r.attempts<3
      and (r.retry_at is null or r.retry_at<=now()) and p.status='active' and p.starts_at>now()
      and public.vybe_plan_visible(r.user_id,p.owner_id)
      and (r.user_id=p.owner_id or exists(select 1 from public.vybe_plan_applications a where a.plan_id=p.id and a.user_id=r.user_id and a.status='approved')));
$job$);
