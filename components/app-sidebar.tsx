'use client'

import * as React from 'react'
import {
  Users,
  CheckSquare,
  History,
  LayoutDashboard,
  User,
  LogOut,
  Code,
  BookOpen,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { supabase } from '@/lib/supabase'

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { setOpenMobile } = useSidebar()
  const [userRole, setUserRole] = React.useState<'estudiante' | 'auxiliar' | null>(null)
  const [userName, setUserName] = React.useState<string | null>(null)

  React.useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session) {
        setUserName(session.user.email?.split('@')[0] || 'Usuario')
        const { data: roleData } = await supabase
          .from('usuarios_roles')
          .select('rol')
          .eq('user_id', session.user.id)
          .single()

        if (roleData) {
          setUserRole(roleData.rol as 'estudiante' | 'auxiliar')
        }
      }
    }

    fetchUser()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Define navigation items based on role
  const getNavItems = () => {
    const commonNav = [
      {
        title: 'Dashboard',
        url: '/dashboard',
        icon: LayoutDashboard,
      },
    ]

    const auxiliarNav = [
      {
        title: 'Estudiantes',
        url: '/estudiantes',
        icon: Users,
      },
      {
        title: 'Marcar Asistencia',
        url: '/marcar-asistencia',
        icon: CheckSquare,
      },
      {
        title: 'Ver Asistencias',
        url: '/ver-asistencias',
        icon: History,
      },
      {
        title: 'Ver Prácticas',
        url: '/practicas',
        icon: BookOpen,
      },
      {
        title: 'Crear Práctica',
        url: '/crear-practica',
        icon: Code,
      },
    ]

    const estudianteNav = [
      {
        title: 'Mis Asistencias',
        url: '/mis-asistencias',
        icon: History,
      },
      {
        title: 'Prácticas',
        url: '/practicas',
        icon: Code,
      },
      {
        title: 'Mi Perfil',
        url: '/mi-perfil',
        icon: User,
      },
    ]

    if (userRole === 'auxiliar') return [...commonNav, ...auxiliarNav]
    if (userRole === 'estudiante') return [...commonNav, ...estudianteNav]
    
    // Default fallback while loading
    return commonNav
  }

  const navItems = getNavItems()

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader className="py-4">
        <div className="flex items-center gap-2 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            S
          </div>
          <span className="font-semibold text-lg truncate group-data-[collapsible=icon]:hidden">
            Sentri
          </span>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    onClick={() => setOpenMobile(false)}
                    tooltip={item.title}
                  >
                    <Link href={item.url}>
                      <item.icon className="mr-2" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 group-data-[collapsible=icon]:p-2">
        {userName && (
          <div className="flex items-center justify-between group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-4">
             <div className="flex flex-col group-data-[collapsible=icon]:hidden">
               <span className="text-sm font-medium">{userName}</span>
               <span className="text-xs text-muted-foreground capitalize">{userRole}</span>
             </div>
             <SidebarMenuButton onClick={handleLogout} tooltip="Cerrar sesión" variant="outline" className="w-auto h-8 px-2">
                <LogOut className="h-4 w-4" />
             </SidebarMenuButton>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
