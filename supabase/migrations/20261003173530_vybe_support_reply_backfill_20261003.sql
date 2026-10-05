
update public.support_tickets
set
  reply_sent_at = coalesce(reply_sent_at,resolved_at,updated_at,created_at),
  user_seen_at = coalesce(user_seen_at,resolved_at,updated_at,created_at)
where reply_text is not null
  and reply_sent_at is null;
