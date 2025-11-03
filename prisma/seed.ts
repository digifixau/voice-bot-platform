import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10)
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@voicebot.com' },
    update: {},
    create: {
      email: 'admin@voicebot.com',
      name: 'Admin User',
      password: adminPassword,
      role: 'ADMIN',
    },
  })

  console.log('Created admin user:', admin.email)

  // Create a sample organization
  const org = await prisma.organization.create({
    data: {
      name: 'Demo Organization',
      description: 'A demo organization for testing',
      n8nWebhookUrl: 'https://your-n8n-webhook-url.com/webhook/call',
    },
  })

  console.log('Created organization:', org.name)

  // Create a sample org user
  const orgUserPassword = await bcrypt.hash('user123', 10)
  
  const orgUser = await prisma.user.create({
    data: {
      email: 'user@demo.com',
      name: 'Demo User',
      password: orgUserPassword,
      role: 'ORG_USER',
      organizationId: org.id,
    },
  })

  console.log('Created org user:', orgUser.email)

  // Create sample contacts
  const contact1 = await prisma.contact.create({
    data: {
      name: 'John Doe',
      phoneNumber: '+1234567890',
      email: 'john@example.com',
      notes: 'Sample contact',
      organizationId: org.id,
    },
  })

  const contact2 = await prisma.contact.create({
    data: {
      name: 'Jane Smith',
      phoneNumber: '+0987654321',
      email: 'jane@example.com',
      notes: 'Another sample contact',
      organizationId: org.id,
    },
  })

  console.log('Created sample contacts:', contact1.name, contact2.name)

  console.log('Seeding completed!')
  console.log('\nLogin credentials:')
  console.log('Admin - Email: admin@voicebot.com, Password: admin123')
  console.log('Org User - Email: user@demo.com, Password: user123')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
