import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createContactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phoneNumber: z.string().min(1, 'Phone number is required'),
  email: z.string().email().optional().or(z.literal('')),
  notes: z.string().optional(),
  businessName: z.string().optional(),
  businessWebsite: z.string().optional().or(z.literal('')),
  customFields: z.record(z.string(), z.string()).optional(),
})

// GET /api/contacts - List all contacts for the user's organization
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const contacts = await prisma.contact.findMany({
      where: { organizationId: session.user.organizationId },
      include: {
        _count: {
          select: {
            calls: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    return NextResponse.json({ contacts })
  } catch (error) {
    console.error('Error fetching contacts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/contacts - Create new contact
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validatedData = createContactSchema.parse(body)

    // Check if contact with same phone number already exists in this organization
    const existingContact = await prisma.contact.findFirst({
      where: {
        phoneNumber: validatedData.phoneNumber,
        organizationId: session.user.organizationId
      }
    })

    if (existingContact) {
      return NextResponse.json(
        { error: 'A contact with this phone number already exists in your organization' },
        { status: 400 }
      )
    }

    const contact = await prisma.contact.create({
      data: {
        name: validatedData.name,
        phoneNumber: validatedData.phoneNumber,
        email: validatedData.email || null,
        notes: validatedData.notes || null,
        businessName: validatedData.businessName || null,
        businessWebsite: validatedData.businessWebsite || null,
        customFields: validatedData.customFields || undefined,
        organizationId: session.user.organizationId
      },
      include: {
        _count: {
          select: {
            calls: true
          }
        }
      }
    })

    return NextResponse.json({ contact }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error('Error creating contact:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
