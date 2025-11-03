# Voice Bot Platform

A multi-tenant SaaS platform for managing voice bot calls for businesses using Retell AI and n8n.

## Features

- 🔐 **Secure Authentication** - NextAuth.js with JWT-based authentication
- 👥 **Multi-tenant Architecture** - Support for multiple organizations
- 🎭 **Role-based Access Control** - Admin and Organization User roles
- 📞 **Call Management** - Initiate, track, and manage voice calls
- 📊 **Analytics & Reports** - Comprehensive call analytics and summaries
- 🎙️ **Call Recordings** - Store and access call recordings
- 📝 **Call Summaries** - AI-generated summaries from Retell AI
- 👤 **Contact Management** - Manage customer contacts

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Authentication**: NextAuth.js v4
- **Database**: PostgreSQL with Prisma ORM (Prisma Accelerate)
- **Styling**: Tailwind CSS v4
- **Voice AI**: Retell AI API
- **Workflow Automation**: n8n webhooks
- **Storage**: Cloudflare R2 (for recordings)
- **Language**: TypeScript

## Database Schema

The platform uses a multi-tenant architecture with the following main entities:

- **Organizations** - Business entities using the platform
- **Users** - Admin and organization users
- **Contacts** - Customer contact information
- **Calls** - Call records with status tracking
- **CallSummaries** - AI-generated call summaries and transcripts
- **CallRecordings** - Call recording metadata and URLs

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL database (Prisma Postgres recommended)
- Retell AI API key
- n8n webhook endpoint

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd voice-bot-platform
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Update the `.env` file with your credentials:
   ```env
   # Database (Already configured with Prisma Postgres)
   DATABASE_URL="your-prisma-accelerate-url"
   RAW_DATABASE_URL="your-raw-postgres-url"
   
   # NextAuth
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-secret-key-here"
   
   # Retell AI
   RETELL_API_KEY="your-retell-api-key"
   
   # Cloudflare R2 (Optional - for storing recordings)
   R2_ACCOUNT_ID="your-r2-account-id"
   R2_ACCESS_KEY_ID="your-r2-access-key"
   R2_SECRET_ACCESS_KEY="your-r2-secret-key"
   R2_BUCKET_NAME="voice-bot-recordings"
   R2_PUBLIC_URL="https://your-r2-public-url.com"
   ```

4. **Generate Prisma Client**
   ```bash
   npx prisma generate
   ```

5. **Run database migrations** (Already done)
   ```bash
   npx prisma migrate dev
   ```

6. **Seed the database**
   ```bash
   npm run db:seed
   ```

   This creates:
   - Admin user: `admin@voicebot.com` / `admin123`
   - Demo organization with an org user: `user@demo.com` / `user123`
   - Sample contacts

7. **Start the development server**
   ```bash
   npm run dev
   ```

8. **Open the application**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

### Admin Functions

Admins can:
- Create and manage organizations
- Create and manage users (both admin and org users)
- View all organizations and their statistics
- Access the admin panel at `/admin`

### Organization Users

Organization users can:
- Manage contacts
- Initiate calls via n8n webhook
- View call history and status
- Access call summaries and transcripts
- Listen to call recordings
- View analytics and reports

## API Endpoints

### Authentication
- `POST /api/auth/signin` - Sign in
- `POST /api/auth/signout` - Sign out
- `GET /api/auth/session` - Get current session

### Admin (Admin only)
- `GET /api/admin/organizations` - List all organizations
- `POST /api/admin/organizations` - Create organization
- `GET /api/admin/organizations/[id]` - Get organization details
- `PATCH /api/admin/organizations/[id]` - Update organization
- `DELETE /api/admin/organizations/[id]` - Delete organization
- `GET /api/admin/users` - List all users
- `POST /api/admin/users` - Create user
- `GET /api/admin/users/[id]` - Get user details
- `PATCH /api/admin/users/[id]` - Update user
- `DELETE /api/admin/users/[id]` - Delete user

### Contacts (Org users)
- `GET /api/contacts` - List contacts
- `POST /api/contacts` - Create contact

### Calls (Org users)
- `GET /api/calls` - List calls (with pagination)
- `POST /api/calls/initiate` - Initiate a new call
- `GET /api/calls/[id]` - Get call details
- `POST /api/calls/[id]/sync` - Sync call data from Retell AI

### Reports (Org users)
- `GET /api/reports/summary` - Get call summary reports

## n8n Webhook Integration

Configure your n8n workflow to:

1. Receive webhook POST requests with:
   ```json
   {
     "callId": "call-id-from-platform",
     "contactName": "Contact Name",
     "phoneNumber": "+1234567890",
     "organizationId": "org-id"
   }
   ```

2. Trigger Retell AI call

3. Return response with:
   ```json
   {
     "retellCallId": "retell-call-id"
   }
   ```

## Retell AI Integration

The platform integrates with Retell AI to:

- Fetch call details and status
- Get call transcripts
- Retrieve AI-generated call summaries
- Access call recordings
- Extract sentiment analysis and key points

Use the `/api/calls/[id]/sync` endpoint to sync call data from Retell AI.

## Cloudflare R2 Setup (Optional)

To store call recordings in Cloudflare R2:

1. Create a Cloudflare R2 bucket
2. Generate API credentials
3. Update the `.env` file with your R2 credentials
4. Implement the upload logic in your n8n workflow or add an upload endpoint

## Project Structure

```
├── prisma/
│   ├── schema.prisma      # Database schema
│   ├── migrations/        # Database migrations
│   └── seed.ts           # Database seeding script
├── src/
│   ├── app/              # Next.js app directory
│   │   ├── api/          # API routes
│   │   ├── admin/        # Admin pages
│   │   ├── dashboard/    # Dashboard pages
│   │   ├── login/        # Login page
│   │   └── layout.tsx    # Root layout
│   ├── components/       # React components
│   ├── lib/             # Utility functions
│   │   ├── prisma.ts    # Prisma client
│   │   ├── auth.ts      # Auth utilities
│   │   └── auth-options.ts # NextAuth config
│   └── types/           # TypeScript types
└── public/              # Static files
```

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint

# Seed database
npm run db:seed
```

## Security Notes

- Change the `NEXTAUTH_SECRET` in production to a secure random string
- Use strong passwords for admin users
- Keep your Retell AI API key secure
- Configure proper CORS settings for production
- Use environment variables for all sensitive data
- Regularly rotate API keys and secrets

## Production Deployment

1. Set up a production PostgreSQL database
2. Update environment variables for production
3. Run database migrations
4. Build the application: `npm run build`
5. Deploy to your hosting provider (Vercel, Railway, etc.)
6. Configure domain and SSL certificates

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - feel free to use this project for your own purposes.

## Support

For issues and questions, please open an issue on GitHub.
