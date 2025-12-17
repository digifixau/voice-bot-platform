import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { Client } from '@upstash/qstash'
import crypto from 'crypto'

const scheduleCallSchema = z.object({
  contactIds: z.array(z.string()).min(1, 'At least one contact is required'),
  scheduledTime: z.string().datetime(),
  fromNumber: z.string().min(1, 'From number is required'),
  agentId: z.string().min(1, 'Agent ID is required'),
  dynamicVariables: z.record(z.string(), z.any()).optional(),
})

// GET /api/scheduled-calls - List scheduled calls
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    const where: any = {
      organizationId: session.user.organizationId
    }

    if (status) {
      where.status = status
    }

    const scheduledCalls = await prisma.scheduledCall.findMany({
      where,
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            email: true,
            businessName: true
          }
        }
      },
      orderBy: {
        scheduledTime: 'asc'
      }
    })

    return NextResponse.json({ scheduledCalls })
  } catch (error) {
    console.error('Error fetching scheduled calls:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/scheduled-calls - Schedule calls to multiple contacts
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validatedData = scheduleCallSchema.parse(body)

    // Verify all contacts belong to the organization
    const contacts = await prisma.contact.findMany({
      where: {
        id: { in: validatedData.contactIds },
        organizationId: session.user.organizationId
      }
    })

    if (contacts.length !== validatedData.contactIds.length) {
      return NextResponse.json({
        error: 'One or more contacts not found or unauthorized'
      }, { status: 404 })
    }

    // Verify agent belongs to organization or create if new
    let agent = await prisma.agent.findUnique({
      where: { retellAgentId: validatedData.agentId }
    })

    if (!agent) {
      // Auto-create the agent if it doesn't exist
      agent = await prisma.agent.create({
        data: {
          retellAgentId: validatedData.agentId,
          organizationId: session.user.organizationId,
          name: `Agent ${validatedData.agentId}`
        }
      })
    } else if (agent.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: 'Agent ID is already registered to another organization' }, { status: 403 })
    }

    // Parse scheduled time
    let batchStartTime = new Date(validatedData.scheduledTime)
    const estimatedDurationMinutes = contacts.length * 2
    const batchEndTime = new Date(batchStartTime.getTime() + (estimatedDurationMinutes * 60 * 1000))

    // Check for conflicts with ANY existing calls
    // We need a gap of 10 mins before and after the new batch.
    // Conflict condition: Existing Call overlaps with [Start - 10m, End + 10m]
    // Since a call is 2 mins long:
    // ExistingCallStart < (BatchEnd + 10m) AND ExistingCallEnd > (BatchStart - 10m)
    // ExistingCallStart < (BatchEnd + 10m) AND (ExistingCallStart + 2m) > (BatchStart - 10m)
    // ExistingCallStart < (BatchEnd + 10m) AND ExistingCallStart > (BatchStart - 12m)
    
    const conflictCheckStart = new Date(batchStartTime.getTime() - (12 * 60 * 1000))
    const conflictCheckEnd = new Date(batchEndTime.getTime() + (10 * 60 * 1000))

    const conflictingCall = await prisma.scheduledCall.findFirst({
      where: {
        organizationId: session.user.organizationId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        scheduledTime: {
          gt: conflictCheckStart,
          lt: conflictCheckEnd
        }
      }
    })

    if (conflictingCall) {
      console.log('Conflict detected with existing calls. Appending to the end of the queue.')
      
      // Find the very last scheduled call to append after
      const lastScheduledCall = await prisma.scheduledCall.findFirst({
        where: {
          organizationId: session.user.organizationId,
          status: { in: ['PENDING', 'IN_PROGRESS'] }
        },
        orderBy: {
          scheduledTime: 'desc'
        }
      })

      if (lastScheduledCall) {
        // Calculate new start time: Last call time + 2 mins (duration est) + 10 mins (buffer)
        const lastCallTime = new Date(lastScheduledCall.scheduledTime)
        batchStartTime = new Date(lastCallTime.getTime() + (12 * 60 * 1000)) // 12 minutes in ms
        console.log(`Adjusting batch start time to ${batchStartTime.toISOString()}`)
      }
    } else {
        console.log('No conflict detected. Scheduling at requested time.')
    }

    // Generate a unique batch ID
    const batchId = crypto.randomUUID()

    // Initialize QStash client
    const qstashClient = new Client({
      token: process.env.QSTASH_TOKEN || '',
    })

    // Determine base URL for webhook
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.VERCEL_URL}`
    const webhookUrl = `${appUrl}/api/webhooks/qstash/trigger-call`
    
    console.log('Scheduling calls with webhook URL:', webhookUrl)

    // Create scheduled calls for each contact
    // We will only schedule the FIRST call with QStash.
    // Subsequent calls will be triggered by the 'call_ended' webhook of the previous call.
    const scheduledCalls = await Promise.all(
      contacts.map(async (contact, index) => {
        // For the first call, use the calculated batch start time.
        // For subsequent calls, we set a theoretical time, but they will be triggered sequentially.
        // We keep the 2-minute stagger in DB just for ordering purposes.
        const callTime = new Date(batchStartTime)
        callTime.setMinutes(callTime.getMinutes() + (index * 2)) 

        const scheduledCall = await prisma.scheduledCall.create({
          data: {
            contactId: contact.id,
            organizationId: session.user.organizationId!,
            fromNumber: validatedData.fromNumber,
            agentId: validatedData.agentId,
            scheduledTime: callTime,
            dynamicVariables: validatedData.dynamicVariables || undefined,
            status: 'PENDING',
            batchId: batchId
          },
          include: {
            contact: {
              select: {
                id: true,
                name: true,
                phoneNumber: true,
                email: true,
                businessName: true
              }
            }
          }
        })

        // Only schedule the FIRST call with QStash
        if (index === 0) {
            try {
            const notBefore = Math.floor(callTime.getTime() / 1000)
            console.log(`Publishing FIRST call of batch ${batchId} to QStash: ${webhookUrl}, scheduledCallId: ${scheduledCall.id}, notBefore: ${notBefore}`)
            
            await qstashClient.publishJSON({
                url: webhookUrl,
                body: { scheduledCallId: scheduledCall.id },
                notBefore: notBefore,
            })
            } catch (qstashError) {
            console.error('Failed to schedule with QStash:', qstashError)
            }
        }

        return scheduledCall
      })
    )

    return NextResponse.json({
      success: true,
      message: `${scheduledCalls.length} call(s) scheduled successfully`,
      scheduledCalls
    }, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error('Error scheduling calls:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
