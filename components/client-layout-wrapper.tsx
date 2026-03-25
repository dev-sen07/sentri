'use client'

import { usePathname } from 'next/navigation'
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function ClientLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  
  // Hide sidebar on the login page or any other auth pages
  const isAuthPage = pathname === '/login' || pathname === '/register'
  
  if (isAuthPage) {
    return <main className="flex-1 w-full h-screen relative">{children}</main>
  }

  return (
    <div className="flex h-screen w-full">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-auto">
        <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
          <SidebarTrigger />
        </header>
        <div className="flex-1 flex flex-col">
          {children}
        </div>
        <footer className="py-6 md:py-8 border-t px-4 shrink-0 text-center text-sm text-muted-foreground mt-auto">
          <p>© {new Date().getFullYear()} Sentri. Todos los derechos reservados.</p>
        </footer>
      </div>
    </div>
  )
}
