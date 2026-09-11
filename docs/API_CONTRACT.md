# Procol Brain API Contract

## GET /api/tickets

Returns all tickets.

## GET /api/tickets/:id

Returns ticket details.

## GET /api/tickets/:id/activity

Returns Brain + Agent activity.

## POST /api/tickets/:id/investigate

Starts Brain investigation.

## POST /api/tickets/:id/approve

Approves the proposed resolution.

## GET /api/agents

Returns available agents.

## GET /api/tasks/:id

Returns task status.

main ticket response:
{
  "id": "PRO-1245",
  "title": "Invoice GST calculation incorrect",
  "customer": "ABC Corp",
  "priority": "HIGH",
  "status": "AI_INVESTIGATING"
}

And activity:

{
  "id": "activity-1",
  "from": "brain",
  "to": "clara",
  "message": "Get product context for invoice issue",
  "status": "completed",
  "timestamp": "2026-09-11T11:30:00Z"
}