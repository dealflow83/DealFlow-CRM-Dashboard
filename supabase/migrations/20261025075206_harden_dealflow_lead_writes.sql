/*
# Harden DealFlow lead write permissions

1. Scope
- Prevent browsers from changing ownership and server-managed timestamps.
- Keep all legitimate seller, property, pipeline, activity, and follow-up fields writable by the authenticated owner.

2. Security
- Revoke broad INSERT and UPDATE privileges from authenticated users.
- Grant only the editable columns needed by the DealFlow interface.
- RLS policies remain owner-scoped and continue to protect every row.

3. Data safety
- No records or existing columns are removed.
*/

REVOKE INSERT, UPDATE ON public.leads FROM authenticated;
GRANT INSERT (seller_name, phone, email, property_address, property_type, estimated_arv, estimated_repairs, asking_price, lead_source, stage, notes, assigned_user_id, next_follow_up_date, closed_profit) ON public.leads TO authenticated;
GRANT UPDATE (seller_name, phone, email, property_address, property_type, estimated_arv, estimated_repairs, asking_price, lead_source, stage, notes, assigned_user_id, next_follow_up_date, closed_profit, last_activity_at, updated_at) ON public.leads TO authenticated;

REVOKE INSERT, UPDATE ON public.lead_activities FROM authenticated;
GRANT INSERT (lead_id, activity_type, note, occurred_at) ON public.lead_activities TO authenticated;
GRANT UPDATE (activity_type, note, occurred_at) ON public.lead_activities TO authenticated;

REVOKE INSERT, UPDATE ON public.follow_ups FROM authenticated;
GRANT INSERT (lead_id, title, event_type, event_date, start_time, notes, completed) ON public.follow_ups TO authenticated;
GRANT UPDATE (lead_id, title, event_type, event_date, start_time, notes, completed, completed_at) ON public.follow_ups TO authenticated;
