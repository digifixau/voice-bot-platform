import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

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

    // Only process call_analyzed events
    if (validatedData.event !== 'call_analyzed') {
      console.log('Ignoring event:', validatedData.event)
      return NextResponse.json({ message: 'Event ignored' })
    }

    const { call } = validatedData

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
    if (call.call_status === 'ended') {
      callStatus = 'COMPLETED'
    } else if (call.call_status === 'failed') {
      callStatus = 'FAILED'
    } else if (call.call_status === 'in_progress') {
      callStatus = 'IN_PROGRESS'
    }

    // Create or update the call record
    const callRecord = await prisma.call.upsert({
      where: { retellCallId: call.call_id },
      create: {
        retellCallId: call.call_id,
        organizationId: agent.organizationId,
        agentId: agent.id,
        callType: call.call_type,
        status: callStatus,
        duration: durationSeconds,
        startedAt: call.start_timestamp ? new Date(call.start_timestamp) : null,
        endedAt: call.end_timestamp ? new Date(call.end_timestamp) : null,
        disconnectionReason: call.disconnection_reason,
      },
      update: {
        status: callStatus,
        duration: durationSeconds,
        startedAt: call.start_timestamp ? new Date(call.start_timestamp) : null,
        endedAt: call.end_timestamp ? new Date(call.end_timestamp) : null,
        disconnectionReason: call.disconnection_reason,
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
          metadata: call.call_analysis ? (call.call_analysis as any) : null,
        },
        update: {
          transcript: call.transcript || null,
          summary: call.call_analysis?.call_summary || null,
          sentiment: call.call_analysis?.user_sentiment?.toLowerCase() || null,
          metadata: call.call_analysis ? (call.call_analysis as any) : null,
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
