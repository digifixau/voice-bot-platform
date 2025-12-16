import { NextRequest, NextResponse } from 'next/server'
import { verifySignatureAppRouter } from '@upstash/qstash/dist/nextjs'
import { prisma } from '@/lib/prisma'

async function handler(req: NextRequest) {
  try {
    const body = await req.json()
    const { scheduledCallId } = body

    if (!scheduledCallId) {
      return NextResponse.json({ error: 'Missing scheduledCallId' }, { status: 400 })
    }

    const scheduledCall = await prisma.scheduledCall.findUnique({
      where: { id: scheduledCallId },
      include: { contact: true }
    })

    if (!scheduledCall) {
      return NextResponse.json({ error: 'Scheduled call not found' }, { status: 404 })
    }

    if (scheduledCall.status !== 'PENDING') {
      return NextResponse.json({ message: 'Call already processed or cancelled' }, { status: 200 })
    }

    // Mark as IN_PROGRESS
    await prisma.scheduledCall.update({
      where: { id: scheduledCallId },
      data: { status: 'IN_PROGRESS', attempts: { increment: 1 } }
    })

    try {
      // Initiate Call via Retell
      const retellApiKey = process.env.RETELL_API_KEY
      if (!retellApiKey) {
        throw new Error('RETELL_API_KEY not configured')
      }

      // Prepare dynamic variables
      const customFields = (scheduledCall.contact.customFields as Record<string, string>) || {}
      const providedVariables = (scheduledCall.dynamicVariables as Record<string, any>) || {}
      
      const dynamicVariables = {
        contact_name: scheduledCall.contact.name,
        contact_phone: scheduledCall.contact.phoneNumber,
        contact_email: scheduledCall.contact.email || '',
        business_name: scheduledCall.contact.businessName || '',
        business_website: scheduledCall.contact.businessWebsite || '',
        ...customFields,
        ...providedVariables,
        current_date: new Date().toLocaleDateString('en-AU', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        }),
        current_time: new Date().toLocaleTimeString('en-AU', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Australia/Sydney'
        }),
      }

      const retellPayload = {
        from_number: scheduledCall.fromNumber,
        to_number: scheduledCall.contact.phoneNumber,
        override_agent_id: scheduledCall.agentId,
        retell_llm_dynamic_variables: dynamicVariables
      }

      const retellResponse = await fetch('https://api.retellai.com/v2/create-phone-call', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${retellApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(retellPayload)
      })

      if (!retellResponse.ok) {
          const errorData = await retellResponse.json()
          throw new Error(`Retell API error: ${JSON.stringify(errorData)}`)
      }

      const retellData = await retellResponse.json()

      // Find internal Agent ID
      const agent = await prisma.agent.findUnique({
        where: { retellAgentId: scheduledCall.agentId }
      })

      // Update ScheduledCall with success
      await prisma.scheduledCall.update({
        where: { id: scheduledCallId },
        data: { 
          status: 'COMPLETED', 
          retellCallId: retellData.call_id,
          executedAt: new Date()
        }
      })
      
      // Create Call record
      await prisma.call.create({
          data: {
              organizationId: scheduledCall.organizationId,
              contactId: scheduledCall.contactId,
              agentId: agent?.id, 
              retellCallId: retellData.call_id,
              status: 'INITIATED',
              direction: 'outbound',
              fromNumber: scheduledCall.fromNumber,
              toNumber: scheduledCall.contact.phoneNumber,
          }
      })

      return NextResponse.json({ success: true, callId: retellData.call_id })

    } catch (error) {
      console.error('Error executing call:', error)
      
      await prisma.scheduledCall.update({
        where: { id: scheduledCallId },
        data: { 
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      })
      
      return NextResponse.json({ error: 'Failed to execute call' }, { status: 500 })
    }

  } catch (error) {
    console.error('Error processing webhook:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export const POST = verifySignatureAppRouter(handler)
