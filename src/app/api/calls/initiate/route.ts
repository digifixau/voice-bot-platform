import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const initiateCallSchema = z.object({
  contactId: z.string().min(1, 'Contact ID is required'),
})

// POST /api/calls/initiate - Initiate a new call via n8n webhook
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { contactId } = initiateCallSchema.parse(body)

    // Get contact and organization details
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        organization: true
      }
    })

    if (!contact || contact.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    if (!contact.organization.n8nWebhookUrl) {
      return NextResponse.json({ error: 'n8n webhook URL not configured for this organization' }, { status: 400 })
    }

    // Create call record
    const call = await prisma.call.create({
      data: {
        contactId: contact.id,
        organizationId: contact.organizationId,
        status: 'INITIATED',
      }
    })

    // Trigger n8n webhook
    try {
      const webhookResponse = await fetch(contact.organization.n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          callId: call.id,
          contactName: contact.name,
          phoneNumber: contact.phoneNumber,
          organizationId: contact.organizationId,
        })
      })

      if (!webhookResponse.ok) {
        throw new Error('Failed to trigger n8n webhook')
      }

      const webhookData = await webhookResponse.json()

      // Update call with retell call ID if provided
      if (webhookData.retellCallId) {
        await prisma.call.update({
          where: { id: call.id },
          data: {
            retellCallId: webhookData.retellCallId,
            status: 'IN_PROGRESS',
            startedAt: new Date(),
          }
        })
      }

      return NextResponse.json({ 
        call: { 
          ...call, 
          retellCallId: webhookData.retellCallId 
        },
        message: 'Call initiated successfully' 
      }, { status: 201 })
    } catch (webhookError) {
      console.error('Webhook error:', webhookError)
      
      // Update call status to failed
      await prisma.call.update({
        where: { id: call.id },
        data: { status: 'FAILED' }
      })

      return NextResponse.json({ 
        error: 'Failed to initiate call via n8n webhook' 
      }, { status: 500 })
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error initiating call:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
