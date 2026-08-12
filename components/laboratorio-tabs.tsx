'use client'

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePathname, useRouter } from "next/navigation"

export function LaboratorioTabs() {
  const pathname = usePathname()
  const router = useRouter()

  // Determinar qué tab está activo
  let activeTab = "practicas"
  const currentPath = pathname || ""
  if (currentPath.includes("/presentar-practicas")) activeTab = "presentar-practicas"
  if (currentPath.includes("/liberacion")) activeTab = "liberacion"

  return (
    <div className="mb-6 flex justify-center sm:justify-start">
      <Tabs value={activeTab} onValueChange={(v) => router.push(`/${v}`)} className="w-full max-w-lg">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="practicas">Prácticas</TabsTrigger>
          <TabsTrigger value="presentar-practicas">Presentaciones</TabsTrigger>
          <TabsTrigger value="liberacion">Liberación</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )
}
