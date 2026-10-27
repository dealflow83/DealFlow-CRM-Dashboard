/*
# Remove anonymous DealFlow data access

1. Security correction
- Remove all Data API privileges for the anonymous role on leads, lead activities, and follow-ups.
- The application requires a signed-in session before loading these tables.

2. Data safety
- No rows, columns, or policies are deleted.
- Authenticated owner-scoped access remains unchanged.
*/

REVOKE ALL PRIVILEGES ON public.leads FROM anon;
REVOKE ALL PRIVILEGES ON public.lead_activities FROM anon;
REVOKE ALL PRIVILEGES ON public.follow_ups FROM anon;
