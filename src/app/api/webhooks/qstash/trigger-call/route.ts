import { NextRequest, NextResponse } from 'next/server'
import { verifySignatureAppRouter } from '@upstash/qstash/dist/nextjs'
import { prisma } from '@/lib/prisma'
import { Client } from '@upstash/qstash'

async function handler(req: NextRequest) {
  console.log('Received QStash webhook request')
  try {
    const body = await req.json()
    console.log('Webhook body:', body)
    const { scheduledCallId } = body

    if (!scheduledCallId) {
      console.error('Missing scheduledCallId in webhook body')
      return NextResponse.json({ error: 'Missing scheduledCallId' }, { status: 400 })
    }

    const scheduledCall = await prisma.scheduledCall.findUnique({
      where: { id: scheduledCallId },
      include: { contact: true }
    })

    if (!scheduledCall) {
      console.error(`Scheduled call not found: ${scheduledCallId}`)
      return NextResponse.json({ error: 'Scheduled call not found' }, { status: 404 })
    }

    console.log(`Processing scheduled call: ${scheduledCallId}, Status: ${scheduledCall.status}`)

    if (scheduledCall.status !== 'PENDING') {
      console.log(`Call ${scheduledCallId} already processed or cancelled`)
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

      console.log('Initiating Retell call with payload:', {
        from_number: scheduledCall.fromNumber,
        to_number: scheduledCall.contact.phoneNumber,
        agent_id: scheduledCall.agentId
      })

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
          console.error('Retell API error:', errorData)
          throw new Error(`Retell API error: ${JSON.stringify(errorData)}`)
      }

      const retellData = await retellResponse.json()
      console.log('Retell call initiated successfully:', retellData)

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

      // TRIGGER NEXT CALL (Daisy-chain recovery)
      // If the call failed to initiate (e.g. invalid number), we must trigger the next one manually
      // because Retell won't send a 'call_ended' webhook for a call that never started.
      try {
        console.log(`Call ${scheduledCallId} failed. Attempting to trigger next call in batch...`)
        
        const whereClause: any = {
            organizationId: scheduledCall.organizationId,
            status: 'PENDING',
        }
        
        if (scheduledCall.batchId) {
            whereClause.batchId = scheduledCall.batchId
        } else {
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
          console.log(`Triggering next scheduled call (recovery): ${nextScheduledCall.id}`)
          
          const qstashClient = new Client({ token: process.env.QSTASH_TOKEN! })
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
          const webhookUrl = `${appUrl}/api/webhooks/qstash/trigger-call`
          
          await qstashClient.publishJSON({
            url: webhookUrl,
            body: { scheduledCallId: nextScheduledCall.id },
          })
          console.log('Next call triggered via QStash (recovery)')
        } else {
          console.log('No more pending calls for this batch (recovery).')
        }
      } catch (recoveryError) {
        console.error('Error in recovery daisy-chaining:', recoveryError)
      }
      
      // Return 200 to prevent QStash from retrying THIS specific failed number
      return NextResponse.json({ message: 'Call failed, moved to next', error: error instanceof Error ? error.message : 'Unknown error' }, { status: 200 })
    }

  } catch (error) {
    console.error('Error processing webhook:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export const POST = verifySignatureAppRouter(handler)
