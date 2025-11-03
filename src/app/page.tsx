import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function Home() {
  const session = await getServerSession(authOptions)

  if (session) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center min-h-screen py-12">
          <div className="text-center">
            <h1 className="text-5xl font-bold text-gray-900 mb-4">
              Voice Bot Platform
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl">
              A multi-tenant platform for managing AI-powered voice bot calls for businesses
            </p>
            <div className="flex gap-4 justify-center">
              <Link
                href="/login"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Sign In
              </Link>
            </div>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="text-indigo-600 mb-4">
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Secure Authentication
              </h3>
              <p className="text-gray-600">
                JWT-based authentication with role-based access control
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="text-indigo-600 mb-4">
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Call Management
              </h3>
              <p className="text-gray-600">
                Initiate, track, and manage voice calls with Retell AI
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="text-indigo-600 mb-4">
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Analytics & Reports
              </h3>
              <p className="text-gray-600">
                Comprehensive analytics and AI-generated call summaries
              </p>
            </div>
          </div>

          <div className="mt-12 text-center">
            <p className="text-sm text-gray-500">
              Demo Credentials: admin@voicebot.com / admin123
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
