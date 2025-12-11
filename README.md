This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app). 

## Voice Bot Platform

A comprehensive voice bot platform with call tracking, contact management, and AI-powered features.

### Features

- 📞 **Call Management** - Track inbound and outbound calls with detailed analytics
- 👥 **Contact Management** - Manage contacts with custom fields and business information
- 🤖 **AI-Powered Custom Fields** - Automatically generate relevant custom fields for contacts using OpenAI
- ☎️ **Outbound Calling** - Place calls directly to contacts from the UI with configurable settings
- 📅 **Call Scheduling** - Schedule calls to multiple contacts with automatic sequential execution
- 📊 **Call Analytics** - View call details, transcripts, and analysis
- 🔐 **Multi-tenant Support** - Organization-based access control
- ⏰ **Automated Call Processing** - Background job processes scheduled calls automatically

### Environment Setup

1. Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

2. Fill in the required environment variables:
- `DATABASE_URL` - Your PostgreSQL database URL
- `NEXTAUTH_SECRET` - Secret for NextAuth.js authentication
- `NEXTAUTH_URL` - Your application URL (e.g., http://localhost:3000)
- `RETELL_API_KEY` - Your Retell AI API key
- `OPENAI_API_KEY` - Your OpenAI API key (for AI custom field generation)

3. Run database migrations:
```bash
npx prisma db push
npx prisma generate
```

### Call Features Setup

#### Immediate Calling
- Click the green "Call" button next to any contact
- Configure the "From Number" and "Agent ID" in the modal
- Click "Call Now" to place the call immediately

#### Bulk Call Scheduling
1. Select multiple contacts using the checkboxes
2. Click "Schedule Calls" button in the header
3. Set the scheduled time (must be in the future)
4. Configure "From Number" and "Agent ID"
5. Calls will be executed sequentially with 2-minute intervals

#### Automated Call Processing
Set up a cron job to process scheduled calls:

**Using Vercel Cron Jobs** (vercel.json):
```json
{
  "crons": [{
    "path": "/api/cron/process-scheduled-calls",
    "schedule": "* * * * *"
  }]
}
```

**Or use any external cron service:**
```bash
# Call this endpoint every minute
curl -X POST https://your-domain.com/api/cron/process-scheduled-calls \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Set `CRON_SECRET` in your environment variables to secure the cron endpoint.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
