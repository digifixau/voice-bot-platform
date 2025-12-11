# Call Placement & Scheduling Guide

This guide explains how to use the call placement and scheduling features in the Voice Bot Platform.

## Features Overview

### 1. Immediate Call Placement
Place calls to contacts instantly from the contacts page.

### 2. Bulk Call Scheduling
Schedule calls to multiple contacts at once with automatic sequential execution.

### 3. Automated Processing
Scheduled calls are automatically executed by a background cron job.

---

## How to Use

### Making an Immediate Call

1. **Navigate to Contacts Page**
   - Go to `/contacts` in your dashboard

2. **Find the Contact**
   - Use the search bar to find a specific contact
   - Or scroll through the contact list

3. **Click "Call" Button**
   - Green "Call" button appears next to each contact

4. **Configure Call Settings**
   - **From Number**: The phone number the call will originate from (must be configured in your Retell account)
   - **Agent ID**: The Retell AI agent that will handle the call
   - Default values are pre-filled but can be changed

5. **Place the Call**
   - Click "Call Now" to initiate the call immediately
   - The system will:
     - Create a call via Retell AI API
     - Store the call record in the database
     - Link it to the contact
     - Pass all contact information and custom fields as dynamic variables to the AI agent

### Scheduling Bulk Calls

1. **Select Contacts**
   - Use checkboxes next to each contact to select multiple contacts
   - Selected count appears in the header: "(X selected)"

2. **Click "Schedule Calls"**
   - Green "Schedule Calls (X)" button appears in the header when contacts are selected

3. **Configure Schedule Settings**
   - **Schedule Time**: Pick a date and time (must be in the future)
   - **From Number**: The number calls will originate from
   - **Agent ID**: The AI agent to handle the calls
   - Review the list of selected contacts

4. **Schedule the Calls**
   - Click "Schedule Calls" button
   - Calls will be scheduled with 2-minute intervals between each contact
   - Example: If you schedule 3 calls for 2:00 PM:
     - Contact 1: 2:00 PM
     - Contact 2: 2:02 PM
     - Contact 3: 2:04 PM

5. **Automatic Execution**
   - The cron job checks every minute for due calls
   - When the scheduled time arrives, calls are automatically placed
   - Each call is tracked and stored in the database

---

## API Endpoints

### POST /api/retell/create-call
Place an immediate call to a contact.

**Request Body:**
```json
{
  "contactId": "clxxx",
  "fromNumber": "+61480038722",
  "agentId": "agent_xxx",
  "dynamicVariables": {
    "custom_field": "value"
  }
}
```

**Response:**
```json
{
  "success": true,
  "callId": "call_xxx",
  "callRecord": { ... },
  "retellResponse": { ... }
}
```

### POST /api/scheduled-calls
Schedule calls to multiple contacts.

**Request Body:**
```json
{
  "contactIds": ["clxxx1", "clxxx2"],
  "scheduledTime": "2025-12-08T14:00:00Z",
  "fromNumber": "+61480038722",
  "agentId": "agent_xxx",
  "dynamicVariables": {
    "custom_field": "value"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "2 call(s) scheduled successfully",
  "scheduledCalls": [ ... ]
}
```

### GET /api/scheduled-calls
List scheduled calls for your organization.

**Query Parameters:**
- `status`: Filter by status (PENDING, IN_PROGRESS, COMPLETED, FAILED, CANCELLED)

**Response:**
```json
{
  "scheduledCalls": [
    {
      "id": "xxx",
      "scheduledTime": "2025-12-08T14:00:00Z",
      "status": "PENDING",
      "contact": {
        "name": "John Doe",
        "phoneNumber": "+61412345678"
      }
    }
  ]
}
```

### DELETE /api/scheduled-calls/[id]
Cancel a scheduled call.

**Response:**
```json
{
  "message": "Scheduled call cancelled successfully"
}
```

### POST /api/cron/process-scheduled-calls
Process pending scheduled calls (called by cron job).

**Headers:**
```
Authorization: Bearer YOUR_CRON_SECRET
```

**Response:**
```json
{
  "success": true,
  "message": "Processed 5 scheduled call(s)",
  "results": {
    "processed": 5,
    "succeeded": 4,
    "failed": 1,
    "errors": ["Error details..."]
  }
}
```

---

## Database Schema

### ScheduledCall Model

```prisma
model ScheduledCall {
  id               String              @id @default(cuid())
  contactId        String
  organizationId   String
  fromNumber       String
  agentId          String
  scheduledTime    DateTime
  status           ScheduledCallStatus @default(PENDING)
  retellCallId     String?
  callId           String?
  dynamicVariables Json?
  errorMessage     String?
  attempts         Int                 @default(0)
  maxAttempts      Int                 @default(3)
  executedAt       DateTime?
  createdAt        DateTime            @default(now())
  updatedAt        DateTime            @updatedAt
}
```

### Status Flow

1. **PENDING**: Waiting to be executed
2. **IN_PROGRESS**: Currently being processed by cron job
3. **COMPLETED**: Successfully executed
4. **FAILED**: Failed after max retry attempts
5. **CANCELLED**: Manually cancelled by user

---

## Dynamic Variables

When placing a call, the system automatically includes:

### Contact Information
- `contact_name`: Contact's name
- `contact_phone`: Contact's phone number
- `contact_email`: Contact's email (if available)
- `business_name`: Business name (if available)
- `business_website`: Business website (if available)

### Custom Fields
All custom fields from the contact are passed as dynamic variables with their snake_case key names.

### Timestamp Information
- `current_date`: Current date in Australian format
- `current_time`: Current time in Australian timezone (AEST)
- `greeting`: Contextual greeting (Good morning/afternoon/evening)

### Custom Variables
You can override or add additional variables by passing `dynamicVariables` in the API request.

---

## Retry Logic

If a scheduled call fails:
- The cron job will automatically retry up to 3 times (configurable via `maxAttempts`)
- Status remains `PENDING` for retries
- After max attempts, status changes to `FAILED`
- Error messages are stored in `errorMessage` field

---

## Best Practices

1. **Test First**: Use immediate calling to test your agent configuration before scheduling bulk calls

2. **Stagger Timing**: The system automatically adds 2-minute intervals between calls to avoid overwhelming your system

3. **Monitor Status**: Check scheduled calls status via the API to track execution

4. **Set Appropriate From Numbers**: Ensure your "From Number" is properly configured in your Retell account

5. **Verify Agent IDs**: Double-check agent IDs before scheduling bulk calls

6. **Use Custom Fields**: Populate contact custom fields for more personalized AI interactions

7. **Schedule During Business Hours**: Be mindful of timezone and business hours when scheduling calls

---

## Troubleshooting

### Call Not Placed
- Verify Retell API key is configured
- Check that agent ID exists and belongs to your organization
- Ensure "From Number" is configured in Retell account
- Verify contact phone number format

### Scheduled Call Not Executed
- Check cron job is running (every minute)
- Verify `CRON_SECRET` environment variable is set
- Check scheduled call status for error messages
- Ensure scheduled time is in the future

### Call Fails Immediately
- Review Retell API response for error details
- Check agent configuration in Retell dashboard
- Verify phone number formats are correct
- Ensure sufficient Retell API credits

---

## Environment Variables

Required environment variables:

```env
RETELL_API_KEY="your-retell-api-key"
CRON_SECRET="your-cron-secret-key"
```

---

## Support

For issues or questions:
1. Check the error message in the scheduled call record
2. Review Retell API logs in your Retell dashboard
3. Check application logs for detailed error information
4. Verify all environment variables are correctly set
