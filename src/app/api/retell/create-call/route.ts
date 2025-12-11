import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createCallSchema = z.object({
  contactId: z.string().min(1, 'Contact ID is required'),
  fromNumber: z.string().min(1, 'From number is required'),
  agentId: z.string().min(1, 'Agent ID is required'),
  dynamicVariables: z.record(z.string(), z.any()).optional(),
})

// POST /api/retell/create-call - Place a call to a contact
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validatedData = createCallSchema.parse(body)

    // Get the contact and verify ownership
    const contact = await prisma.contact.findUnique({
      where: { id: validatedData.contactId }
    })

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    if (contact.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Get the agent to find organizationId for linking
    const agent = await prisma.agent.findFirst({
      where: { 
        retellAgentId: validatedData.agentId,
        organizationId: session.user.organizationId
      }
    })

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found or unauthorized' }, { status: 403 })
    }

    // Prepare dynamic variables by merging contact custom fields with provided variables
    const customFields = (contact.customFields as Record<string, string>) || {}
    const dynamicVariables = {
      // Contact info
      contact_name: contact.name,
      contact_phone: contact.phoneNumber,
      contact_email: contact.email || '',
      business_name: contact.businessName || '',
      business_website: contact.businessWebsite || '',
      
      // Custom fields from contact
      ...customFields,
      
      // Override with any provided dynamic variables
      ...(validatedData.dynamicVariables || {}),
      
      // Add timestamp info
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
    const retellApiKey = process.env.RETELL_API_KEY
    if (!retellApiKey) {
      return NextResponse.json({ error: 'Retell API key not configured' }, { status: 500 })
    }

    const retellPayload = {
      from_number: validatedData.fromNumber,
      to_number: contact.phoneNumber,
      override_agent_id: validatedData.agentId,
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
      console.error('Retell API error:', retellData)
      return NextResponse.json({
        error: 'Failed to create call',
        details: retellData
      }, { status: retellResponse.status })
    }

    // Create call record in database
    const callRecord = await prisma.call.create({
      data: {
        retellCallId: retellData.call_id,
        agentId: agent.id,
        contactId: contact.id,
        fromNumber: validatedData.fromNumber,
        toNumber: contact.phoneNumber,
        direction: 'outbound',
        clientPhoneNumber: contact.phoneNumber,
        startedAt: new Date(),
        status: 'INITIATED',
        organizationId: session.user.organizationId
      }
    })

    return NextResponse.json({
      success: true,
      callId: retellData.call_id,
      callRecord: callRecord,
      retellResponse: retellData
    }, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error('Error creating call:', error)
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
