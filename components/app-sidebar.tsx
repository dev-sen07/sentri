'use client'

import * as React from 'react'
import {
  Users,
  CheckSquare,
  History,
  LayoutDashboard,
  User,
  Sparkles,
  Video,
  Star,
  Activity,
  FileText,
  FlaskConical,
  LogOut,
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
  const [userRole, setUserRole] = React.useState<'estudiante' | 'auxiliar' | 'delegado' | null>(null)
  const [userName, setUserName] = React.useState<string | null>(null)

  React.useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const emailName = session.user.email?.split('@')[0] || 'Usuario'
        setUserName(emailName) // Optimistic fast update
        
        const { data: roleData } = await supabase
          .from('usuarios_roles')
          .select('rol')
          .eq('user_id', session.user.id)
          .single()

        if (roleData) {
          const role = roleData.rol as 'estudiante' | 'auxiliar' | 'delegado'
          setUserRole(role)
          
          if (role === 'estudiante' || role === 'delegado') {
            const { data: studentData } = await supabase
              .from('estudiantes')
              .select('nombre, apellido')
              .eq('user_id', session.user.id)
              .single()
            if (studentData) {
              setUserName(`${studentData.nombre} ${studentData.apellido}`)
            }
          } else if (role === 'auxiliar') {
            setUserName('Docente / Auxiliar')
          }
        }
      }
    }
    fetchUser()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const getNavItems = () => {
    const commonNav = [
      { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
    ]

    const auxiliarNav = [
      { title: 'Estudiantes', url: '/estudiantes', icon: Users },
      { title: 'Marcar Asistencia', url: '/marcar-asistencia', icon: CheckSquare },
      { title: 'Extras', url: '/extras', icon: Star },
      { title: 'Laboratorio', url: '/practicas', icon: FlaskConical },
      { title: 'Reporte Final', url: '/reporte-estudiantes', icon: FileText },
      { title: 'Clases Grabadas', url: '/clases-grabadas', icon: Video },
    ]

    const estudianteNav = [
      { title: 'Mis Asistencias', url: '/mis-asistencias', icon: History },
      { title: 'Laboratorio', url: '/practicas', icon: FlaskConical },
      { title: 'Clases Grabadas', url: '/clases-grabadas', icon: Video },
      { title: 'Mi Perfil', url: '/mi-perfil', icon: User },
    ]

    const delegadoNav = [
      ...estudianteNav,
      { title: 'Actividades', url: '/mis-actividades', icon: Activity },
    ]

    if (userRole === 'auxiliar') return [...commonNav, ...auxiliarNav]
    if (userRole === 'estudiante') return [...commonNav, ...estudianteNav]
    if (userRole === 'delegado') return [...commonNav, ...delegadoNav]
    return commonNav
  }

  const navItems = getNavItems()

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader className="py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white font-bold text-lg shadow-md">
            S
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <span className="font-bold text-lg leading-none">Sentri</span>
            <div className="flex items-center gap-1 mt-0.5">
              <Sparkles className="w-3 h-3 text-violet-400" />
              <span className="text-xs text-sidebar-foreground/50">Sistema Académico</span>
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase text-xs tracking-widest">Navegación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    onClick={() => setOpenMobile(false)}
                    tooltip={item.title}
                    className="transition-all duration-150"
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

      <SidebarFooter className="p-3 border-t border-sidebar-border group-data-[collapsible=icon]:p-2">
        {userName && (
          <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:flex-col">
            <div className="group-data-[collapsible=icon]:hidden flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate leading-none">{userName}</p>
                <p className="text-xs text-sidebar-foreground/50 capitalize mt-0.5">{userRole}</p>
              </div>
            </div>
            <SidebarMenuButton
              onClick={handleLogout}
              tooltip="Cerrar sesión"
              variant="outline"
              className="w-auto h-8 px-2 shrink-0 text-sidebar-foreground/70 hover:text-red-400 hover:border-red-400/50 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </SidebarMenuButton>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
