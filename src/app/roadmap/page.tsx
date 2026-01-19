import Link from 'next/link'

export default function RoadmapPage() {
  const milestones = [
    {
      title: 'Phase 1: Foundation',
      status: 'completed',
      date: 'Q4 2025',
      items: [
        'Project initialization with Next.js 15 & Typescript',
        'Database Schema design (Prisma & PostgreSQL)',
        'Authentication system (NextAuth.js)',
        'Basic UI Shell & Navigation',
      ]
    },
    {
      title: 'Phase 2: Core CRM Features',
      status: 'completed',
      date: 'Jan 2026',
      items: [
        'Organization & User Management (Admin Panel)',
        'Contact Management (CRUD operations)',
        'Dynamic Custom Fields for Contacts',
        'Secure API Routes for data access',
      ]
    },
    {
      title: 'Phase 3: Voice Integration',
      status: 'completed',
      date: 'Jan 2026',
      items: [
        'Call AI Integration',
        'Call Logs & History View',
        'Multi-Agent Support per Organization',
        'Organization-level Default Phone Numbers',
        'Outbound Call Initiation from UI',
      ]
    },
    {
      title: 'Phase 4: Advanced Features',
      status: 'in-progress',
      date: 'Q1 2026',
      items: [
        'Call Scheduling & Queueing',
        'Inbound Call Webhooks',
        'Real-time Call Status Updates',
        'Voice Agent Selection during calls',
      ]
    },
    {
      title: 'Phase 5: Analytics & Scale',
      status: 'planned',
      date: 'Q2 2026',
      items: [
        'Advanced Reporting Dashboard',
        'Call Sentiment Analysis Visualization',
        'Campaign Management',
        'Bulk Contact Import/Export',
      ]
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Development Roadmap</h1>
          <p className="text-lg text-gray-600">
            Tracking the progress of the Voice Bot Platform.
          </p>
          <div className="mt-4">
            <Link href="/login" className="text-indigo-600 hover:text-indigo-500 font-medium">
              &larr; Back to Login
            </Link>
          </div>
        </div>

        <div className="space-y-8">
          {milestones.map((milestone, index) => (
            <div key={index} className="relative pl-8 sm:pl-32 py-2 group">
              {/* Timeline Line */}
              <div className="absolute left-2 sm:left-0 top-0 h-full w-px bg-gray-200 group-last:h-0"></div>
              
              {/* Status Dot */}
              <div className={`absolute left-0 sm:left-[-5px] top-3 h-4 w-4 rounded-full border-2 
                ${milestone.status === 'completed' ? 'bg-green-500 border-green-500' : 
                  milestone.status === 'in-progress' ? 'bg-blue-500 border-blue-500 animate-pulse' : 
                  'bg-white border-gray-300'}`}
              ></div>

              {/* Date (Desktop) */}
              <div className="hidden sm:block absolute left-[-8rem] top-2 w-28 text-right">
                <span className="text-sm font-semibold text-gray-500">{milestone.date}</span>
                <div className="text-xs font-medium uppercase mt-1 tracking-wider">
                  <span className={`
                    ${milestone.status === 'completed' ? 'text-green-600' : 
                      milestone.status === 'in-progress' ? 'text-blue-600' : 
                      'text-gray-400'}
                  `}>
                    {milestone.status}
                  </span>
                </div>
              </div>

              {/* Content Card */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold text-gray-900">{milestone.title}</h3>
                  {/* Date (Mobile) */}
                  <span className="sm:hidden text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    {milestone.date}
                  </span>
                </div>
                
                <ul className="space-y-3">
                  {milestone.items.map((item, i) => (
                    <li key={i} className="flex items-start">
                      <svg className={`h-5 w-5 mr-3 flex-shrink-0 
                        ${milestone.status === 'completed' ? 'text-green-500' : 
                          milestone.status === 'in-progress' ? 'text-blue-500' : 'text-gray-300'}`} 
                        fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-600 dark:text-gray-300">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-12 text-center border-t pt-8 border-gray-200">
          <p className="text-sm text-gray-500">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  )
}
