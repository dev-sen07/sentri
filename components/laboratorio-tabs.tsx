'use client'

import { usePathname, useRouter } from "next/navigation"
import { BookOpen, FileUp, GraduationCap } from "lucide-react"

const TABS = [
  { value: "practicas", label: "Prácticas", shortLabel: "Prácticas", icon: BookOpen },
  { value: "presentar-practicas", label: "Presentaciones", shortLabel: "Presentar", icon: FileUp },
  { value: "liberacion/admin", label: "Liberación", shortLabel: "Liberación", icon: GraduationCap },
]

export function LaboratorioTabs() {
  const pathname = usePathname()
  const router = useRouter()

  // Determinar qué tab está activo
  let activeTab = "practicas"
  const currentPath = pathname || ""
  if (currentPath.includes("/presentar-practicas")) activeTab = "presentar-practicas"
  if (currentPath.includes("/liberacion")) activeTab = "liberacion"

  return (
    <div className="flex gap-0 border-b border-border mb-6 overflow-x-auto">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          onClick={() => router.push(`/${tab.value}`)}
          className={`px-4 sm:px-5 py-2.5 font-medium text-sm transition-colors flex items-center gap-2 border-b-2 -mb-px shrink-0 ${
            activeTab === tab.value
              ? 'text-primary border-primary'
              : 'text-muted-foreground border-transparent hover:text-foreground'
          }`}
        >
          <tab.icon className="w-4 h-4" />
          <span className="hidden sm:inline">{tab.label}</span>
          <span className="sm:hidden">{tab.shortLabel}</span>
        </button>
      ))}
    </div>
  )
}
