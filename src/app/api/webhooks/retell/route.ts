import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { Client } from '@upstash/qstash'
import { sendCallNotificationEmail } from '@/lib/email'

// Retell AI webhook payload schema
const retellWebhookSchema = z.object({
  event: z.string(),
  call: z.object({
    call_id: z.string(),
    call_type: z.string().optional(),
    agent_id: z.string(),
    agent_name: z.string().optional(),
    call_status: z.string(),
    start_timestamp: z.number().optional(),
    end_timestamp: z.number().optional(),
    duration_ms: z.number().optional(),
    transcript: z.string().optional(),
    transcript_object: z.array(z.any()).optional(),
    recording_url: z.string().optional(),
    disconnection_reason: z.string().optional(),
    from_number: z.string().optional(),
    to_number: z.string().optional(),
    direction: z.string().optional(), // 'inbound' or 'outbound'
    call_analysis: z.object({
      call_summary: z.string().optional(),
      in_voicemail: z.boolean().optional(),
      user_sentiment: z.string().optional(),
      call_successful: z.boolean().optional(),
      custom_analysis_data: z.any().optional(),
    }).optional(),
  })
})

// POST /api/webhooks/retell - Handle Retell AI webhooks
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    console.log('Retell webhook received:', JSON.stringify(body, null, 2))

    // Validate webhook payload
    const validatedData = retellWebhookSchema.parse(body)

    const { call } = validatedData

    // Handle call_started event - create initial call record
    if (validatedData.event === 'call_started') {
      console.log('Processing call_started event')

      // Find the agent and organization
      const agent = await prisma.agent.findUnique({
        where: { retellAgentId: call.agent_id },
        include: { organization: true }
      })

      if (!agent) {
        console.error('Agent not found:', call.agent_id)
        return NextResponse.json(
          { error: 'Agent not found. Please register this agent first.' },
          { status: 404 }
        )
      }

      // Determine client's phone number based on direction
      const direction = call.direction?.toLowerCase()
      const clientPhoneNumber = direction === 'inbound' ? call.from_number : call.to_number

      // Try to find existing contact by phone number
      let contactId: string | null = null
      if (clientPhoneNumber) {
        const contact = await prisma.contact.findFirst({
          where: {
            phoneNumber: clientPhoneNumber,
            organizationId: agent.organizationId
          }
        })
        contactId = contact?.id || null
      }

      // Create initial call record
      await prisma.call.upsert({
        where: { retellCallId: call.call_id },
        create: {
          retellCallId: call.call_id,
          organizationId: agent.organizationId,
          agentId: agent.id,
          contactId: contactId,
          callType: call.call_type,
          status: call.call_status === 'ongoing' ? 'IN_PROGRESS' : 'INITIATED',
          startedAt: call.start_timestamp ? new Date(call.start_timestamp) : null,
          fromNumber: call.from_number,
          toNumber: call.to_number,
          direction: direction,
          clientPhoneNumber: clientPhoneNumber,
        },
        update: {
          status: call.call_status === 'ongoing' ? 'IN_PROGRESS' : 'INITIATED',
          startedAt: call.start_timestamp ? new Date(call.start_timestamp) : null,
          fromNumber: call.from_number,
          toNumber: call.to_number,
          direction: direction,
          clientPhoneNumber: clientPhoneNumber,
        },
      })

      console.log('Call started record created/updated')
      return NextResponse.json({ success: true, message: 'Call started processed' })
    }

    // Only process call_analyzed events for full details
    if (validatedData.event !== 'call_analyzed') {
      console.log('Ignoring event:', validatedData.event)
      return NextResponse.json({ message: 'Event ignored' })
    }

    // Find the agent and organization
    const agent = await prisma.agent.findUnique({
      where: { retellAgentId: call.agent_id },
      include: { organization: true }
    })

    if (!agent) {
      console.error('Agent not found:', call.agent_id)
      return NextResponse.json(
        { error: 'Agent not found. Please register this agent first.' },
        { status: 404 }
      )
    }

    // Calculate duration in seconds
    const durationMs = call.duration_ms || 0
    const durationSeconds = Math.floor(durationMs / 1000)

    // Map call status
    let callStatus: 'INITIATED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'NO_ANSWER' = 'COMPLETED'
    
    const disconnectionReason = call.disconnection_reason;

    if (call.call_status === 'failed') {
      callStatus = 'FAILED'
    } else if (call.call_status === 'ended') {
      if (disconnectionReason === 'dial_no_answer' || disconnectionReason === 'dial_busy') {
        callStatus = 'NO_ANSWER';
      } else if (disconnectionReason === 'dial_failed' || disconnectionReason?.startsWith('error_')) {
        callStatus = 'FAILED';
      } else {
        callStatus = 'COMPLETED';
      }
    } else if (call.call_status === 'in_progress') {
      callStatus = 'IN_PROGRESS'
    }

    // Determine client's phone number based on direction
    // If inbound: client is from_number (caller)
    // If outbound: client is to_number (recipient)
    const direction = call.direction?.toLowerCase()
    const clientPhoneNumber = direction === 'inbound' ? call.from_number : call.to_number

    // Try to find existing contact by phone number
    let contactId: string | null = null
    if (clientPhoneNumber) {
      const contact = await prisma.contact.findFirst({
        where: {
          phoneNumber: clientPhoneNumber,
          organizationId: agent.organizationId
        }
      })
      contactId = contact?.id || null
    }

    // Create or update the call record
    const callRecord = await prisma.call.upsert({
      where: { retellCallId: call.call_id },
      create: {
        retellCallId: call.call_id,
        organizationId: agent.organizationId,
        agentId: agent.id,
        contactId: contactId,
        callType: call.call_type,
        status: callStatus,
        duration: durationSeconds,
        startedAt: call.start_timestamp ? new Date(call.start_timestamp) : null,
        endedAt: call.end_timestamp ? new Date(call.end_timestamp) : null,
        disconnectionReason: call.disconnection_reason,
        fromNumber: call.from_number,
        toNumber: call.to_number,
        direction: direction,
        clientPhoneNumber: clientPhoneNumber,
      },
      update: {
        contactId: contactId,
        status: callStatus,
        duration: durationSeconds,
        startedAt: call.start_timestamp ? new Date(call.start_timestamp) : null,
        endedAt: call.end_timestamp ? new Date(call.end_timestamp) : null,
        disconnectionReason: call.disconnection_reason,
        fromNumber: call.from_number,
        toNumber: call.to_number,
        direction: direction,
        clientPhoneNumber: clientPhoneNumber,
      },
    })

    console.log('Call record created/updated:', callRecord.id)

    // Create or update call summary if analysis is available
    if (call.call_analysis || call.transcript) {
      const summary = await prisma.callSummary.upsert({
        where: { callId: callRecord.id },
        create: {
          callId: callRecord.id,
          transcript: call.transcript || null,
          summary: call.call_analysis?.call_summary || null,
          sentiment: call.call_analysis?.user_sentiment?.toLowerCase() || null,
          keyPoints: [], // Can be extracted from custom_analysis_data if needed
          actionItems: [], // Can be extracted from custom_analysis_data if needed
          metadata: {
            ...(call.call_analysis as any),
            disconnection_reason: call.disconnection_reason
          },
        },
        update: {
          transcript: call.transcript || null,
          summary: call.call_analysis?.call_summary || null,
          sentiment: call.call_analysis?.user_sentiment?.toLowerCase() || null,
          metadata: {
            ...(call.call_analysis as any),
            disconnection_reason: call.disconnection_reason
          },
        },
      })

      console.log('Call summary created/updated:', summary.id)
    }

    // Create or update call recording if available
    if (call.recording_url) {
      const recording = await prisma.callRecording.upsert({
        where: { callId: callRecord.id },
        create: {
          callId: callRecord.id,
          recordingUrl: call.recording_url,
          duration: durationSeconds,
          format: 'wav', // Default from Retell
        },
        update: {
          recordingUrl: call.recording_url,
          duration: durationSeconds,
        },
      })

      console.log('Call recording created/updated:', recording.id)
    }

    // Send email notification for the completed call
    try {
      // Fetch contact name if available
      let contactName: string | undefined
      if (callRecord.contactId) {
        const contact = await prisma.contact.findUnique({
          where: { id: callRecord.contactId },
          select: { name: true }
        })
        contactName = contact?.name
      }

      await sendCallNotificationEmail(agent.organizationId, {
        callId: callRecord.id,
        retellCallId: call.call_id,
        direction: direction || 'unknown',
        status: callStatus,
        duration: durationSeconds,
        fromNumber: call.from_number,
        toNumber: call.to_number,
        clientPhoneNumber: clientPhoneNumber,
        contactName,
        agentName: agent.name,
        transcript: call.transcript,
        summary: call.call_analysis?.call_summary,
        sentiment: call.call_analysis?.user_sentiment,
        recordingUrl: call.recording_url,
        startedAt: call.start_timestamp ? new Date(call.start_timestamp) : undefined,
        endedAt: call.end_timestamp ? new Date(call.end_timestamp) : undefined,
      })
    } catch (emailError) {
      // Don't fail the webhook if email fails
      console.error('Error sending call notification email:', emailError)
    }

    // Trigger the next scheduled call (Daisy-chaining)
    try {
      // Find the ScheduledCall associated with this Retell call
      const currentScheduledCall = await prisma.scheduledCall.findFirst({
        where: { retellCallId: call.call_id }
      })

      if (currentScheduledCall) {
        console.log(`Found associated ScheduledCall: ${currentScheduledCall.id}. Checking for next call in batch ${currentScheduledCall.batchId || 'none'}...`)

        // Find the next PENDING ScheduledCall for this organization AND batch
        // We strictly follow the batch ID to avoid interleaving different call lists.
        const whereClause: any = {
            organizationId: currentScheduledCall.organizationId,
            status: 'PENDING',
        }
        
        if (currentScheduledCall.batchId) {
            whereClause.batchId = currentScheduledCall.batchId
        } else {
            // For legacy calls without batchId, we might want to process them or just ignore batching.
            // But to be safe and avoid picking up a new batch's calls, we should probably look for null batchId.
            whereClause.batchId = null
        }

        const nextScheduledCall = await prisma.scheduledCall.findFirst({
          where: whereClause,
          orderBy: [
            { scheduledTime: 'asc' },
            { createdAt: 'asc' }
          ]
        })

        if (nextScheduledCall) {
          console.log(`Triggering next scheduled call: ${nextScheduledCall.id}`)
          
          const qstashClient = new Client({ token: process.env.QSTASH_TOKEN! })
          // Ensure we have the correct base URL. 
          // In production, NEXT_PUBLIC_APP_URL should be set. 
          // If running locally with ngrok, it should be the ngrok URL.
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
          const webhookUrl = `${appUrl}/api/webhooks/qstash/trigger-call`
          
          console.log(`Publishing to QStash: ${webhookUrl}`)
          await qstashClient.publishJSON({
            url: webhookUrl,
            body: { scheduledCallId: nextScheduledCall.id },
          })
          console.log('Next call triggered via QStash')
        } else {
          console.log('No more pending calls for this organization.')
        }
      }
    } catch (chainError) {
      console.error('Error in daisy-chaining calls:', chainError)
    }

    return NextResponse.json({
      success: true,
      message: 'Call analysis processed successfully',
      callId: callRecord.id,
      organizationId: agent.organizationId,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation error:', error.issues)
      return NextResponse.json(
        { error: 'Invalid webhook payload', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error processing webhook:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/webhooks/retell - Verify webhook endpoint
export async function GET() {
  return NextResponse.json({
    message: 'Retell AI webhook endpoint is active',
    events: ['call_analyzed'],
  })
}
