'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { LaboratorioTabs, LabTab } from '@/components/laboratorio-tabs'
import { PracticasContent } from '@/app/practicas/page'
import { PresentarPracticasContent } from '@/app/presentar-practicas/page'
import { LiberacionContent } from '@/app/liberacion/page'

const VALID_TABS: LabTab[] = ['practicas', 'presentar-practicas', 'liberacion']

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  )
}

function LaboratorioInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const initialTab: LabTab = VALID_TABS.includes(requestedTab as LabTab) ? (requestedTab as LabTab) : 'practicas'

  const [checkingAuth, setCheckingAuth] = useState(true)
  const [activeTab, setActiveTab] = useState<LabTab>(initialTab)
  const [visitedTabs, setVisitedTabs] = useState<Set<LabTab>>(new Set([initialTab]))

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      setCheckingAuth(false)
    }
    checkAuth()
  }, [router])

  const handleTabChange = useCallback((tab: LabTab) => {
    setActiveTab(tab)
    setVisitedTabs((prev) => (prev.has(tab) ? prev : new Set(prev).add(tab)))
    router.replace(`/laboratorio?tab=${tab}`, { scroll: false })
  }, [router])

  if (checkingAuth) return <Spinner />

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 pt-8">
        <LaboratorioTabs active={activeTab} onChange={handleTabChange} />
      </div>

      {visitedTabs.has('practicas') && (
        <div hidden={activeTab !== 'practicas'}>
          <PracticasContent />
        </div>
      )}
      {visitedTabs.has('presentar-practicas') && (
        <div hidden={activeTab !== 'presentar-practicas'}>
          <PresentarPracticasContent />
        </div>
      )}
      {visitedTabs.has('liberacion') && (
        <div hidden={activeTab !== 'liberacion'}>
          <LiberacionContent />
        </div>
      )}
    </div>
  )
}

export default function LaboratorioPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <LaboratorioInner />
    </Suspense>
  )
}
