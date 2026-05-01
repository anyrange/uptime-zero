# Uptime Roadmap

## Current State

The app now has:

- SSR admin auth with admin-only settings and status page management
- Monitor CRUD for HTTP, keyword, JSON, and push monitors
- Scheduled checks through cron and a singleton Durable Object
- Heartbeats, incidents, public status pages, SSE dashboard updates, and webhook notifications
- Configurable retention for heartbeats and closed incidents
- Real monitor detail uptime and latency metrics over retained history

## Stage 1: Core Product Completion

Status: mostly complete

- [x] Admin auth bootstrap
- [x] Monitor CRUD
- [x] Polling scheduler
- [x] Push monitor ingestion
- [x] Incidents on state transitions
- [x] Public status page route
- [x] Status page admin CRUD
- [x] Webhook notification setup
- [x] Retention settings
- [x] Uptime and latency metrics on monitor detail

Still missing in this stage:

- [ ] Better dashboard filtering and search
- [ ] Rich incident management beyond auto-open/auto-close
- [ ] More complete monitor history views

## Stage 2: Notifications v2

Priority: high

- [ ] Notification provider model beyond generic webhooks
- [ ] Slack provider
- [ ] Discord provider
- [ ] Email provider
- [ ] Telegram provider
- [ ] Test-send flow for notification methods
- [ ] Delivery retry and backoff
- [ ] Delivery audit log
- [ ] Per-monitor notification bindings
- [ ] Event-type selection per notification method

## Stage 3: SSL Certificate Monitoring

Priority: high

- [ ] Capture certificate expiry for HTTPS monitors
- [ ] Persist current certificate summary and heartbeat-level certificate data
- [ ] Warning thresholds for 30d, 14d, 7d, 3d, expired
- [ ] UI surfacing on monitor detail and dashboard
- [ ] Notifications for expiring and expired certificates

## Stage 4: Maintenance Windows

Priority: high

- [ ] One-off maintenance windows
- [ ] Recurring maintenance windows
- [ ] Scheduler awareness so checks can be muted or annotated
- [ ] Incident suppression during maintenance
- [ ] Notification suppression during maintenance
- [ ] Public status page maintenance messaging

## Stage 5: More Monitor Types

Priority: medium

- [ ] TCP connect monitor
- [ ] DNS resolve monitor
- [ ] TLS handshake monitor
- [ ] Ping-style monitor if feasible on Workers
- [ ] Improved push monitor payload semantics

## Stage 6: Product Polish

Priority: medium

- [ ] Dashboard grouping and sorting
- [ ] Status page incident timeline
- [ ] Better response-time charting
- [ ] Tagging or grouping of monitors
- [ ] Multi-user role model if the product grows beyond single-admin installs
- [ ] More automated test coverage across repository and route behavior
