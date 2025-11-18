'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect } from 'react'

interface Contact {
  id: string
  name: string
  phoneNumber: string
  email?: string
  businessName?: string
  businessWebsite?: string
  notes?: string
  customFields?: Record<string, string>
  organizationId: string
  createdAt: string
  _count?: {
    calls: number
  }
}

export default function ContactsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const [contactForm, setContactForm] = useState({
    name: '',
    phoneNumber: '',
    email: '',
    businessName: '',
    businessWebsite: '',
    notes: '',
    customFields: [] as { key: string; value: string }[]
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    if (session) {
      fetchContacts()
    }
  }, [session])

  const fetchContacts = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/contacts')
      const data = await res.json()
      setContacts(data.contacts || [])
    } catch (error) {
      console.error('Error fetching contacts:', error)
    } finally {
      setLoading(false)
    }
  }

  const openModal = (contact?: Contact) => {
    if (contact) {
      setEditingContact(contact)
      // Convert customFields object to array for editing
      const customFieldsArray = contact.customFields
        ? Object.entries(contact.customFields).map(([key, value]) => ({ key, value }))
        : []
      setContactForm({
        name: contact.name,
        phoneNumber: contact.phoneNumber,
        email: contact.email || '',
        businessName: contact.businessName || '',
        businessWebsite: contact.businessWebsite || '',
        notes: contact.notes || '',
        customFields: customFieldsArray
      })
    } else {
      setEditingContact(null)
      setContactForm({ 
        name: '', 
        phoneNumber: '', 
        email: '', 
        businessName: '', 
        businessWebsite: '', 
        notes: '',
        customFields: []
      })
    }
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const url = editingContact
        ? `/api/contacts/${editingContact.id}`
        : '/api/contacts'
      const method = editingContact ? 'PATCH' : 'POST'

      // Convert customFields array to object
      const customFieldsObject = contactForm.customFields.reduce((acc, field) => {
        if (field.key.trim()) {
          acc[field.key.trim()] = field.value
        }
        return acc
      }, {} as Record<string, string>)

      const payload = {
        name: contactForm.name,
        phoneNumber: contactForm.phoneNumber,
        email: contactForm.email,
        businessName: contactForm.businessName,
        businessWebsite: contactForm.businessWebsite,
        notes: contactForm.notes,
        customFields: Object.keys(customFieldsObject).length > 0 ? customFieldsObject : undefined
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        setShowModal(false)
        setEditingContact(null)
        setContactForm({ 
          name: '', 
          phoneNumber: '', 
          email: '', 
          businessName: '', 
          businessWebsite: '', 
          notes: '',
          customFields: []
        })
        fetchContacts()
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || 'Failed to save contact'}`)
      }
    } catch (error) {
      console.error('Error saving contact:', error)
      alert('Failed to save contact')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (contactId: string) => {
    if (!confirm('Are you sure you want to delete this contact? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchContacts()
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || 'Failed to delete contact'}`)
      }
    } catch (error) {
      console.error('Error deleting contact:', error)
      alert('Failed to delete contact')
    }
  }

  const filteredContacts = contacts.filter(contact => {
    const query = searchQuery.toLowerCase()
    return (
      contact.name.toLowerCase().includes(query) ||
      contact.phoneNumber.includes(query) ||
      contact.email?.toLowerCase().includes(query)
    )
  })

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="shrink-0 flex items-center">
                <Link href="/dashboard" className="text-xl font-bold text-gray-900">
                  Voice Bot Platform
                </Link>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link
                  href="/dashboard"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Dashboard
                </Link>
                <Link
                  href="/contacts"
                  className="border-indigo-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Contacts
                </Link>
                <Link
                  href="/calls"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Calls
                </Link>
              </div>
            </div>
            <div className="flex items-center">
              <span className="text-sm text-gray-700 mr-4">
                {session?.user?.email}
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="py-10">
        <header>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
            <h1 className="text-3xl font-bold leading-tight text-gray-900">
              Contacts
            </h1>
            <button
              onClick={() => openModal()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Add Contact
            </button>
          </div>
        </header>

        <main>
          <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div className="px-4 py-8 sm:px-0">
              {/* Search Bar */}
              <div className="mb-6">
                <input
                  type="text"
                  placeholder="Search contacts by name, phone, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Contacts List */}
              <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                {loading ? (
                  <div className="text-center py-12 px-4">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
                    <p className="text-sm text-gray-500">Loading contacts...</p>
                  </div>
                ) : filteredContacts.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">
                      {searchQuery ? 'No contacts found' : 'No contacts yet'}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      {searchQuery
                        ? 'Try adjusting your search query.'
                        : 'Get started by adding your first contact.'}
                    </p>
                    {!searchQuery && (
                      <div className="mt-6">
                        <button
                          onClick={() => openModal()}
                          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                        >
                          Add Contact
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-200">
                    {filteredContacts.map((contact) => (
                      <li key={contact.id}>
                        <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-indigo-600 truncate">
                                    {contact.name}
                                  </p>
                                  {contact.businessName && (
                                    <p className="text-xs text-gray-500 mt-0.5">
                                      {contact.businessName}
                                    </p>
                                  )}
                                </div>
                                {contact._count?.calls !== undefined && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                    {contact._count.calls} call{contact._count.calls !== 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                              <div className="mt-2 sm:flex sm:justify-between">
                                <div className="sm:flex sm:flex-wrap sm:gap-x-6 gap-y-2">
                                  <p className="flex items-center text-sm text-gray-500">
                                    <svg
                                      className="shrink-0 mr-1.5 h-5 w-5 text-gray-400"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                      />
                                    </svg>
                                    {contact.phoneNumber}
                                  </p>
                                  {contact.email && (
                                    <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                                      <svg
                                        className="shrink-0 mr-1.5 h-5 w-5 text-gray-400"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                        />
                                      </svg>
                                      {contact.email}
                                    </p>
                                  )}
                                  {contact.businessWebsite && (
                                    <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                                      <svg
                                        className="shrink-0 mr-1.5 h-5 w-5 text-gray-400"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                                        />
                                      </svg>
                                      <a 
                                        href={contact.businessWebsite} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-indigo-600 hover:text-indigo-800"
                                      >
                                        {contact.businessWebsite.replace(/^https?:\/\//, '')}
                                      </a>
                                    </p>
                                  )}
                                </div>
                              </div>
                              {contact.customFields && Object.keys(contact.customFields).length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {Object.entries(contact.customFields).map(([key, value]) => (
                                    <span key={key} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                      {key}: {value}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {contact.notes && (
                                <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                                  {contact.notes}
                                </p>
                              )}
                            </div>
                            <div className="ml-4 flex gap-2">
                              <button
                                onClick={() => openModal(contact)}
                                className="text-sm text-indigo-600 hover:text-indigo-900"
                                title="Edit contact"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(contact.id)}
                                className="text-sm text-red-600 hover:text-red-900"
                                title="Delete contact"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Add/Edit Contact Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-[600px] max-h-[90vh] overflow-y-auto shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                {editingContact ? 'Edit Contact' : 'Add New Contact'}
              </h3>
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={contactForm.name}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Enter contact name"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={contactForm.phoneNumber}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, phoneNumber: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="+1234567890"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={contactForm.email}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, email: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="contact@example.com"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Business Name
                  </label>
                  <input
                    type="text"
                    value={contactForm.businessName}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, businessName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Company or business name"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Business Website
                  </label>
                  <input
                    type="url"
                    value={contactForm.businessWebsite}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, businessWebsite: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="https://example.com"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={contactForm.notes}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, notes: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Add any notes about this contact..."
                    rows={3}
                  />
                </div>

                {/* Custom Fields */}
                <div className="mb-4 border-t pt-4">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Custom Fields
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setContactForm({
                          ...contactForm,
                          customFields: [...contactForm.customFields, { key: '', value: '' }]
                        })
                      }
                      className="text-sm text-indigo-600 hover:text-indigo-800"
                    >
                      + Add Field
                    </button>
                  </div>
                  {contactForm.customFields.map((field, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={field.key}
                        onChange={(e) => {
                          const newFields = [...contactForm.customFields]
                          newFields[index].key = e.target.value
                          setContactForm({ ...contactForm, customFields: newFields })
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Field name"
                      />
                      <input
                        type="text"
                        value={field.value}
                        onChange={(e) => {
                          const newFields = [...contactForm.customFields]
                          newFields[index].value = e.target.value
                          setContactForm({ ...contactForm, customFields: newFields })
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Value"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newFields = contactForm.customFields.filter((_, i) => i !== index)
                          setContactForm({ ...contactForm, customFields: newFields })
                        }}
                        className="px-3 py-2 text-red-600 hover:text-red-800"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {contactForm.customFields.length === 0 && (
                    <p className="text-sm text-gray-500 italic">No custom fields added</p>
                  )}
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false)
                      setEditingContact(null)
                      setContactForm({ 
                        name: '', 
                        phoneNumber: '', 
                        email: '', 
                        businessName: '', 
                        businessWebsite: '', 
                        notes: '',
                        customFields: []
                      })
                    }}
                    className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting
                      ? editingContact
                        ? 'Updating...'
                        : 'Creating...'
                      : editingContact
                      ? 'Update Contact'
                      : 'Create Contact'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
