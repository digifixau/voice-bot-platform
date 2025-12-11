import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/cron/process-scheduled-calls - Process pending scheduled calls
// This endpoint should be called by a cron job every minute
export async function POST(req: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'your-cron-secret-key'
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    
    // Find scheduled calls that are due and pending
    const dueCalls = await prisma.scheduledCall.findMany({
      where: {
        status: 'PENDING',
        scheduledTime: {
          lte: now
        }
      },
      include: {
        contact: true
      },
      orderBy: {
        scheduledTime: 'asc'
      },
      take: 10 // Process max 10 calls per run to avoid timeout
    })

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as string[]
    }

    for (const scheduledCall of dueCalls) {
      // Mark as in progress
      await prisma.scheduledCall.update({
        where: { id: scheduledCall.id },
        data: { 
          status: 'IN_PROGRESS',
          attempts: scheduledCall.attempts + 1
        }
      })

      try {
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
          greeting: getGreeting(),
        }

        // Call Retell API
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

        const retellData = await retellResponse.json().catch(() => null)

        if (!retellResponse.ok) {
          throw new Error(`Retell API error: ${JSON.stringify(retellData)}`)
        }

        // Get agent for database record
        const agent = await prisma.agent.findFirst({
          where: { retellAgentId: scheduledCall.agentId }
        })

        // Create call record
        const callRecord = await prisma.call.create({
          data: {
            retellCallId: retellData.call_id,
            agentId: agent?.id,
            contactId: scheduledCall.contact.id,
            fromNumber: scheduledCall.fromNumber,
            toNumber: scheduledCall.contact.phoneNumber,
            direction: 'outbound',
            clientPhoneNumber: scheduledCall.contact.phoneNumber,
            startedAt: new Date(),
            status: 'INITIATED',
            organizationId: scheduledCall.organizationId
          }
        })

        // Mark scheduled call as completed
        await prisma.scheduledCall.update({
          where: { id: scheduledCall.id },
          data: {
            status: 'COMPLETED',
            retellCallId: retellData.call_id,
            callId: callRecord.id,
            executedAt: new Date()
          }
        })

        results.succeeded++
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        
        // Determine if we should retry
        const shouldRetry = scheduledCall.attempts < scheduledCall.maxAttempts
        
        await prisma.scheduledCall.update({
          where: { id: scheduledCall.id },
          data: {
            status: shouldRetry ? 'PENDING' : 'FAILED',
            errorMessage: errorMessage
          }
        })

        results.failed++
        results.errors.push(`Contact ${scheduledCall.contact.name}: ${errorMessage}`)
      }

      results.processed++
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${results.processed} scheduled call(s)`,
      results
    })
  } catch (error) {
    console.error('Error processing scheduled calls:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

// GET endpoint for manual trigger (for testing)
export async function GET(req: NextRequest) {
  return POST(req)
}
