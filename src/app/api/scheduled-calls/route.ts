import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { Client } from '@upstash/qstash'

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
    const scheduledTime = new Date(validatedData.scheduledTime)

    // Initialize QStash client
    const qstashClient = new Client({
      token: process.env.QSTASH_TOKEN || '',
    })

    // Determine base URL for webhook
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.VERCEL_URL}`
    const webhookUrl = `${appUrl}/api/webhooks/qstash/trigger-call`

    // Create scheduled calls for each contact
    // Stagger calls by 2 minutes to ensure sequential execution
    const scheduledCalls = await Promise.all(
      contacts.map(async (contact, index) => {
        const callTime = new Date(scheduledTime)
        callTime.setMinutes(callTime.getMinutes() + (index * 2)) // 2-minute intervals

        const scheduledCall = await prisma.scheduledCall.create({
          data: {
            contactId: contact.id,
            organizationId: session.user.organizationId!,
            fromNumber: validatedData.fromNumber,
            agentId: validatedData.agentId,
            scheduledTime: callTime,
            dynamicVariables: validatedData.dynamicVariables || undefined,
            status: 'PENDING'
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

        // Schedule with QStash
        try {
          const notBefore = Math.floor(callTime.getTime() / 1000)
          
          await qstashClient.publishJSON({
            url: webhookUrl,
            body: { scheduledCallId: scheduledCall.id },
            notBefore: notBefore,
          })
        } catch (qstashError) {
          console.error('Failed to schedule with QStash:', qstashError)
          // Optionally update status to FAILED or log error
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
