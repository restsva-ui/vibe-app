-- Clear expired meeting details; the job touches only the new plan-location table.
select cron.schedule('vybe-plans-address-retention','23 * * * *', $job$
  update public.vybe_plan_locations l set meeting_details='[expired]'
  from public.vybe_plans p where l.plan_id=p.id and p.ends_at<=now() and l.meeting_details<>'[expired]';
$job$);
