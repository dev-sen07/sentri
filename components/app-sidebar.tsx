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

  const getNavGroups = () => {
    if (userRole === 'auxiliar') {
      return [
        {
          label: 'Principal',
          items: [
            { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, color: 'text-blue-500' },
            { title: 'Estudiantes', url: '/estudiantes', icon: Users, color: 'text-violet-500' },
          ]
        },
        {
          label: 'Académico',
          items: [
            { title: 'Marcar Asistencia', url: '/marcar-asistencia', icon: CheckSquare, color: 'text-emerald-500' },
            { title: 'Extras', url: '/extras', icon: Star, color: 'text-amber-500' },
          ]
        },
        {
          label: 'Laboratorio',
          items: [
            { title: 'Laboratorio', url: '/practicas', icon: FlaskConical, color: 'text-cyan-500' },
            { title: 'Reporte Final', url: '/reporte-estudiantes', icon: FileText, color: 'text-rose-500' },
          ]
        },
        {
          label: 'Recursos',
          items: [
            { title: 'Clases Grabadas', url: '/clases-grabadas', icon: Video, color: 'text-fuchsia-500' },
          ]
        }
      ]
    }

    const baseEstudianteNav = [
      {
        label: 'Principal',
        items: [
          { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, color: 'text-blue-500' },
          { title: 'Mi Perfil', url: '/mi-perfil', icon: User, color: 'text-violet-500' },
        ]
      },
      {
        label: 'Académico',
        items: [
          { title: 'Mis Asistencias', url: '/mis-asistencias', icon: History, color: 'text-emerald-500' },
          { title: 'Laboratorio', url: '/practicas', icon: FlaskConical, color: 'text-cyan-500' },
          { title: 'Clases Grabadas', url: '/clases-grabadas', icon: Video, color: 'text-fuchsia-500' },
        ]
      }
    ]

    if (userRole === 'delegado') {
      baseEstudianteNav.push({
        label: 'Delegado',
        items: [
          { title: 'Actividades', url: '/mis-actividades', icon: Activity, color: 'text-amber-500' },
        ]
      })
    }

    if (userRole === 'estudiante' || userRole === 'delegado') {
      return baseEstudianteNav
    }

    return [
      {
        label: 'Principal',
        items: [
          { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, color: 'text-blue-500' },
        ]
      }
    ]
  }

  const navGroups = getNavGroups()

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader className="py-4 border-b border-sidebar-border/50">
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white font-bold text-lg shadow-lg shadow-indigo-500/20">
            S
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <span className="font-bold text-lg leading-none tracking-tight">Sentri</span>
            <div className="flex items-center gap-1 mt-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span className="text-xs text-sidebar-foreground/50 font-medium">Sistema Académico</span>
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0 py-2">
        {navGroups.map((group, index) => (
          <SidebarGroup key={group.label} className={index !== 0 ? "mt-2 pt-2 border-t border-sidebar-border/50" : ""}>
            <SidebarGroupLabel className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-widest px-4 mb-2">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.url || (item.url !== '/dashboard' && pathname.startsWith(item.url))}
                      onClick={() => setOpenMobile(false)}
                      tooltip={item.title}
                      className="transition-all duration-200 hover:bg-sidebar-accent/50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium"
                    >
                      <Link href={item.url} className="flex items-center gap-3 px-1 py-0.5">
                        <item.icon className={`w-4 h-4 ${item.color}`} />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border/50 group-data-[collapsible=icon]:p-2">
        {userName && (
          <div className="flex items-center justify-between gap-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:flex-col bg-sidebar-accent/30 p-2 rounded-2xl border border-sidebar-border/30">
            <div className="group-data-[collapsible=icon]:hidden flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-md">
                {userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate text-sidebar-foreground">{userName}</p>
                <p className="text-xs text-sidebar-foreground/60 capitalize mt-0.5 font-medium">{userRole}</p>
              </div>
            </div>
            <SidebarMenuButton
              onClick={handleLogout}
              tooltip="Cerrar sesión"
              variant="outline"
              className="w-9 h-9 p-0 shrink-0 text-sidebar-foreground/60 hover:text-red-500 hover:bg-red-500/10 hover:border-red-500/30 transition-all rounded-xl"
            >
              <LogOut className="h-4 w-4" />
            </SidebarMenuButton>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
