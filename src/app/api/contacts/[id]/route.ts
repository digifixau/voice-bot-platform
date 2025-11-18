import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateContactSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  phoneNumber: z.string().min(1, 'Phone number is required').optional(),
  email: z.string().email().optional().or(z.literal('')),
  notes: z.string().optional(),
  businessName: z.string().optional(),
  businessWebsite: z.string().optional().or(z.literal('')),
  customFields: z.record(z.string(), z.string()).optional(),
})

// GET /api/contacts/[id] - Get contact details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const contact = await prisma.contact.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            calls: true
          }
        }
      }
    })

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    // Verify contact belongs to user's organization
    if (contact.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    return NextResponse.json({ contact })
  } catch (error) {
    console.error('Error fetching contact:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/contacts/[id] - Update contact
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Check if contact exists and belongs to user's organization
    const existingContact = await prisma.contact.findUnique({
      where: { id }
    })

    if (!existingContact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    if (existingContact.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await req.json()
    const validatedData = updateContactSchema.parse(body)

    // If phone number is being updated, check for duplicates
    if (validatedData.phoneNumber && validatedData.phoneNumber !== existingContact.phoneNumber) {
      const duplicateContact = await prisma.contact.findFirst({
        where: {
          phoneNumber: validatedData.phoneNumber,
          organizationId: session.user.organizationId,
          id: { not: id }
        }
      })

      if (duplicateContact) {
        return NextResponse.json(
          { error: 'A contact with this phone number already exists in your organization' },
          { status: 400 }
        )
      }
    }

    // Prepare update data
    const updateData: any = {}
    if (validatedData.name !== undefined) updateData.name = validatedData.name
    if (validatedData.phoneNumber !== undefined) updateData.phoneNumber = validatedData.phoneNumber
    if (validatedData.email !== undefined) updateData.email = validatedData.email || null
    if (validatedData.notes !== undefined) updateData.notes = validatedData.notes || null
    if (validatedData.businessName !== undefined) updateData.businessName = validatedData.businessName || null
    if (validatedData.businessWebsite !== undefined) updateData.businessWebsite = validatedData.businessWebsite || null
    if (validatedData.customFields !== undefined) updateData.customFields = validatedData.customFields || undefined

    const contact = await prisma.contact.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: {
            calls: true
          }
        }
      }
    })

    return NextResponse.json({ contact })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error('Error updating contact:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/contacts/[id] - Delete contact
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Check if contact exists and belongs to user's organization
    const existingContact = await prisma.contact.findUnique({
      where: { id }
    })

    if (!existingContact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    if (existingContact.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    await prisma.contact.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Contact deleted successfully' })
  } catch (error) {
    console.error('Error deleting contact:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
