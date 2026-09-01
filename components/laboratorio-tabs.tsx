'use client'

import { BookOpen, FileUp, GraduationCap, LucideIcon } from "lucide-react"

export type LabTab = "practicas" | "presentar-practicas" | "liberacion"

const TABS: { value: LabTab; label: string; shortLabel: string; icon: LucideIcon }[] = [
  { value: "practicas", label: "Prácticas", shortLabel: "Prácticas", icon: BookOpen },
  { value: "presentar-practicas", label: "Presentaciones", shortLabel: "Presentar", icon: FileUp },
  { value: "liberacion", label: "Liberación", shortLabel: "Liberación", icon: GraduationCap },
]

export function LaboratorioTabs({
  active,
  onChange,
}: {
  active: LabTab
  onChange: (tab: LabTab) => void
}) {
  return (
    <div className="flex gap-0 border-b border-border mb-6 overflow-x-auto">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={`px-4 sm:px-5 py-2.5 font-medium text-sm transition-colors flex items-center gap-2 border-b-2 -mb-px shrink-0 ${
            active === tab.value
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
