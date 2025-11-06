import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

// POST /api/calls/[id]/sync - Sync call data from Retell AI
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get call
    const call = await prisma.call.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId
      },
      include: {
        organization: true
      }
    })

    if (!call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    if (!call.retellCallId) {
      return NextResponse.json({ error: 'Call does not have a Retell call ID' }, { status: 400 })
    }

    const retellApiKey = call.organization.retellApiKey || process.env.RETELL_API_KEY

    if (!retellApiKey) {
      return NextResponse.json({ error: 'Retell API key not configured' }, { status: 400 })
    }

    // Fetch call data from Retell AI
    const retellResponse = await fetch(
      `https://api.retellai.com/v2/calls/${call.retellCallId}`,
      {
        headers: {
          'Authorization': `Bearer ${retellApiKey}`,
        }
      }
    )

    if (!retellResponse.ok) {
      throw new Error('Failed to fetch call data from Retell AI')
    }

    const retellData = await retellResponse.json()

    // Update call record
    await prisma.call.update({
      where: { id: call.id },
      data: {
        status: retellData.status === 'ended' ? 'COMPLETED' : 
                retellData.status === 'failed' ? 'FAILED' : 
                'IN_PROGRESS',
        duration: retellData.duration_ms ? Math.floor(retellData.duration_ms / 1000) : null,
        startedAt: retellData.start_timestamp ? new Date(retellData.start_timestamp) : null,
        endedAt: retellData.end_timestamp ? new Date(retellData.end_timestamp) : null,
      }
    })

    // Create or update call summary if available
    if (retellData.transcript || retellData.call_analysis) {
      await prisma.callSummary.upsert({
        where: { callId: call.id },
        create: {
          callId: call.id,
          transcript: retellData.transcript || null,
          summary: retellData.call_analysis?.summary || null,
          sentiment: retellData.call_analysis?.sentiment || null,
          keyPoints: retellData.call_analysis?.key_points || [],
          actionItems: retellData.call_analysis?.action_items || [],
          metadata: retellData.call_analysis || null,
        },
        update: {
          transcript: retellData.transcript || null,
          summary: retellData.call_analysis?.summary || null,
          sentiment: retellData.call_analysis?.sentiment || null,
          keyPoints: retellData.call_analysis?.key_points || [],
          actionItems: retellData.call_analysis?.action_items || [],
          metadata: retellData.call_analysis || null,
        }
      })
    }

    // Create or update recording if available
    if (retellData.recording_url) {
      await prisma.callRecording.upsert({
        where: { callId: call.id },
        create: {
          callId: call.id,
          recordingUrl: retellData.recording_url,
          duration: retellData.duration_ms ? Math.floor(retellData.duration_ms / 1000) : null,
          format: 'mp3',
        },
        update: {
          recordingUrl: retellData.recording_url,
          duration: retellData.duration_ms ? Math.floor(retellData.duration_ms / 1000) : null,
        }
      })
    }

    // Fetch updated call
    const updatedCall = await prisma.call.findUnique({
      where: { id: call.id },
      include: {
        contact: true,
        agent: {
          select: {
            id: true,
            name: true,
            retellAgentId: true,
          }
        },
        summary: true,
        recording: true,
      }
    })

    return NextResponse.json({ 
      call: updatedCall,
      message: 'Call synced successfully' 
    })
  } catch (error) {
    console.error('Error syncing call:', error)
    return NextResponse.json({ error: 'Failed to sync call data' }, { status: 500 })
  }
}
