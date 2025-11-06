# Retell AI Webhook Setup

This document explains how to configure Retell AI webhooks to automatically sync call data with the Voice Bot Platform.

## Overview

The platform receives call analysis data from Retell AI via webhooks. Each call is associated with an organization through the agent that handled it.

## Webhook Endpoint

```
POST https://your-domain.com/api/webhooks/retell
```

This endpoint:
- **Does NOT require authentication** (uses public POST route)
- Processes `call_analyzed` events from Retell AI
- Maps calls to organizations using the `agent_id` field
- Creates/updates Call, CallSummary, and CallRecording records

## Setup Steps

### 1. Register Your Agents

Before receiving webhooks, you must register your Retell AI agents in the platform:

**Via API:**
```bash
POST /api/agents
Authorization: Bearer <session-token>

{
  "retellAgentId": "agent_f9b744d05b598a9ab2b1df2a79",
  "name": "Customer Support Bot",
  "organizationId": "<org-id>"
}
```

**Via Admin UI (Coming Soon):**
Navigate to Admin Panel → Agents → Add New Agent

### 2. Configure Retell AI Dashboard

1. Log in to your [Retell AI Dashboard](https://app.retellai.com)
2. Navigate to **Settings** → **Webhooks**
3. Add a new webhook:
   - **URL:** `https://your-domain.com/api/webhooks/retell`
   - **Events:** Select `call_analyzed`
   - **Status:** Active

### 3. Test the Webhook

Use the sample payload to test locally:

```bash
curl -X POST http://localhost:3000/api/webhooks/retell \
  -H "Content-Type: application/json" \
  -d '{
    "event": "call_analyzed",
    "call": {
      "call_id": "test-call-123",
      "agent_id": "agent_f9b744d05b598a9ab2b1df2a79",
      "call_status": "ended",
      "start_timestamp": 1730596863000,
      "end_timestamp": 1730596923000,
      "transcript": "Agent: Hello! How can I help you today?\nUser: I need information about your services.\nAgent: I would be happy to help you with that.",
      "call_analysis": {
        "call_summary": "Customer inquiry about services",
        "in_voicemail": false,
        "user_sentiment": "Positive",
        "call_successful": true,
        "custom_analysis_data": {
          "intent": "information_request",
          "topic": "services"
        }
      },
      "recording_url": "https://storage.retellai.com/recordings/test-call-123.mp3",
      "public_log_url": "https://app.retellai.com/logs/test-call-123",
      "disconnection_reason": "user_hangup"
    }
  }'
```

Expected response (200 OK):
```json
{
  "success": true,
  "callId": "<database-call-id>"
}
```

### 4. Verify Data

After testing:
1. Log in to the platform
2. Navigate to **Dashboard** → **Calls**
3. Verify the test call appears with correct:
   - Agent name
   - Call duration
   - Transcript
   - Sentiment analysis
   - Recording link

## Webhook Event Structure

### Supported Events

Currently, the platform handles:
- ✅ `call_analyzed` - Sent when a call completes and analysis is ready

Future support planned for:
- ⏳ `call_started` - Real-time call initiation
- ⏳ `call_ended` - Immediate call completion (before analysis)

### Call Status Mapping

Retell AI → Platform:
- `ended` → `COMPLETED`
- `failed` → `FAILED`
- Other → `IN_PROGRESS`

### Data Mapping

| Retell Field | Platform Field | Model |
|--------------|----------------|-------|
| `call_id` | `retellCallId` | Call |
| `agent_id` | `agentId` (via Agent lookup) | Call |
| `start_timestamp` | `startedAt` | Call |
| `end_timestamp` | `endedAt` | Call |
| `call_status` | `status` | Call |
| `transcript` | `transcript` | CallSummary |
| `call_analysis.call_summary` | `summary` | CallSummary |
| `call_analysis.user_sentiment` | `sentiment` | CallSummary |
| `call_analysis.custom_analysis_data` | `metadata` | CallSummary |
| `recording_url` | `url` | CallRecording |
| `public_log_url` | `metadata.public_log_url` | CallRecording |
| `disconnection_reason` | `disconnectionReason` | Call |

## Agent Management

### Multiple Agents Per Organization

Organizations can have multiple agents assigned:

```typescript
// Example: E-commerce company with specialized bots
Organization: "ShopNow Inc"
├── Agent: "Order Support Bot" (agent_abc123)
├── Agent: "Product Inquiry Bot" (agent_def456)
└── Agent: "Returns Bot" (agent_ghi789)
```

All calls from these agents will be associated with "ShopNow Inc".

### Agent API Endpoints

**List Agents:**
```bash
GET /api/agents
# Returns agents for authenticated user's organization
# Admins see all agents across all organizations
```

**Create Agent:**
```bash
POST /api/agents
{
  "retellAgentId": "agent_xyz789",
  "name": "New Bot",
  "organizationId": "org-id"  # Admin only
}
```

**Update Agent:**
```bash
PATCH /api/agents/[id]
{
  "name": "Updated Bot Name",
  "organizationId": "new-org-id"  # Admin only
}
```

**Delete Agent:**
```bash
DELETE /api/agents/[id]
# Admin only
# Sets existing calls' agentId to null (preserves history)
```

## Error Handling

### Agent Not Found (404)

If the webhook receives a `call_analyzed` event with an unknown `agent_id`:

```json
{
  "error": "Agent not found",
  "message": "No agent registered with retellAgentId: agent_unknown123"
}
```

**Resolution:** Register the agent via `/api/agents` before Retell AI sends webhooks.

### Validation Errors (400)

If the webhook payload is malformed:

```json
{
  "error": "Invalid webhook payload",
  "details": [...]
}
```

**Resolution:** Ensure Retell AI is sending the correct event structure.

### Server Errors (500)

Database or internal errors:

```json
{
  "error": "Failed to process webhook"
}
```

**Resolution:** Check server logs and database connectivity.

## Security Considerations

### Current Implementation
- Webhook endpoint is **public** (no authentication required)
- Validates payload structure using Zod schema
- Only creates/updates data for registered agents

### Recommended for Production
1. **IP Whitelisting:** Restrict webhook endpoint to Retell AI IP ranges
2. **Signature Verification:** Implement HMAC signature validation (if Retell AI provides webhook secrets)
3. **Rate Limiting:** Add rate limiting to prevent abuse
4. **Logging:** Monitor webhook failures and suspicious activity

Example signature verification (pseudocode):
```typescript
const signature = request.headers.get('x-retell-signature');
const isValid = verifyHMAC(signature, request.body, WEBHOOK_SECRET);
if (!isValid) {
  return new Response('Unauthorized', { status: 401 });
}
```

## Monitoring

### Health Checks

Monitor webhook success rate:
```sql
-- Recent webhook processing success rate
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_calls,
  COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as successful
FROM "Call"
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at);
```

### Failed Webhooks

Check for calls without summaries (indicates webhook processing failure):
```sql
SELECT c.* 
FROM "Call" c
LEFT JOIN "CallSummary" cs ON c.id = cs."callId"
WHERE cs.id IS NULL 
  AND c."createdAt" > NOW() - INTERVAL '1 day';
```

## Troubleshooting

### Calls Not Appearing in Dashboard

1. **Verify agent is registered:**
   ```bash
   GET /api/agents
   # Check if the agent_id exists
   ```

2. **Check webhook logs:**
   ```bash
   # In development
   npm run dev
   # Watch terminal for webhook POST requests
   ```

3. **Test webhook manually:**
   Use the curl command from step 3 above

### Wrong Organization Assignment

- Verify the agent's `organizationId` is correct:
  ```bash
  GET /api/agents/[agent-id]
  ```
- Update if needed:
  ```bash
  PATCH /api/agents/[agent-id]
  { "organizationId": "correct-org-id" }
  ```

### Missing Call Recordings

- Check if `recording_url` is present in Retell webhook
- Verify recording URL is accessible (not expired)
- Check `CallRecording` table for entries:
  ```sql
  SELECT * FROM "CallRecording" WHERE "callId" = 'call-id';
  ```

## Next Steps

1. ✅ Webhook endpoint created
2. ✅ Agent management APIs ready
3. ✅ Database schema updated
4. ⏳ Create Agent management UI in admin panel
5. ⏳ Add webhook activity dashboard
6. ⏳ Implement signature verification
7. ⏳ Add webhook retry mechanism for failed deliveries

## Support

For issues or questions:
- Check application logs: `npm run dev` or production logs
- Review Retell AI webhook delivery logs in their dashboard
- Test webhook endpoint with sample payload
- Verify agent registration before expecting calls
