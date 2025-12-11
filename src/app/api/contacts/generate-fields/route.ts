import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { openai } from '@/lib/openai'
import { z } from 'zod'

const generateFieldsSchema = z.object({
  name: z.string().min(1),
  phoneNumber: z.string().min(1),
  email: z.string().optional(),
  businessName: z.string().optional(),
  businessWebsite: z.string().optional(),
  notes: z.string().optional(),
})

// POST /api/contacts/generate-fields - Generate custom fields using AI
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validatedData = generateFieldsSchema.parse(body)

    // Construct prompt for OpenAI
    const prompt = `You are an AI assistant helping to generate useful custom fields for a business contact management system.

Given the following contact information:
- Name: ${validatedData.name}
- Phone: ${validatedData.phoneNumber}
${validatedData.email ? `- Email: ${validatedData.email}` : ''}
${validatedData.businessName ? `- Business Name: ${validatedData.businessName}` : ''}
${validatedData.businessWebsite ? `- Website: ${validatedData.businessWebsite}` : ''}
${validatedData.notes ? `- Notes: ${validatedData.notes}` : ''}

Generate 5-10 relevant custom fields that would be useful for tracking this contact. Consider fields like:
- Company details (domain, locations, services/offers)
- Pain points or business challenges
- Benefits or value propositions
- Key contact information
- Industry-specific details
- Call tracking preferences

Return ONLY a valid JSON object with key-value pairs where both keys and values are strings. Use snake_case for keys.
Example format:
{
  "company_domain": "example.com",
  "primary_location": "Sydney, Australia",
  "main_service": "Professional services",
  "pain_signal": "After-hours coverage",
  "key_benefit": "24/7 availability"
}

Do not include any markdown formatting, explanation, or additional text - only the JSON object.`

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that generates structured custom field data for business contacts. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
    })

    const generatedContent = completion.choices[0]?.message?.content?.trim()
    
    if (!generatedContent) {
      return NextResponse.json({ error: 'Failed to generate fields' }, { status: 500 })
    }

    // Parse the JSON response
    let customFields: Record<string, string>
    try {
      // Remove markdown code blocks if present
      const cleanedContent = generatedContent
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()
      
      customFields = JSON.parse(cleanedContent)
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', generatedContent)
      return NextResponse.json({ 
        error: 'Failed to parse generated fields',
        details: generatedContent 
      }, { status: 500 })
    }

    return NextResponse.json({ customFields })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error('Error generating custom fields:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
