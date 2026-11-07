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
  Code,
  CalendarDays,
  ClipboardCheck,
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

type Role = 'estudiante' | 'auxiliar' | 'delegado'

type NavItem = {
  title: string
  url: string
  icon: React.ElementType
  color: string
}

type NavGroup = {
  label: string
  items: NavItem[]
}// Los colores de icono se resuelven con tokens del tema (chart-1..5 e info),
// así funcionan igual en modo claro y oscuro.
const AUXILIAR_NAV: NavGroup[] = [
  {
    label: 'Principal',
    items: [
      { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, color: 'text-chart-2' },
      { title: 'Estudiantes', url: '/estudiantes', icon: Users, color: 'text-chart-1' },
    ],
  },
  {
    label: 'Académico',
    items: [
      { title: 'Marcar Asistencia', url: '/marcar-asistencia', icon: CheckSquare, color: 'text-chart-3' },
      { title: 'Extras', url: '/extras', icon: Star, color: 'text-chart-4' },
      { title: 'Parciales', url: '/parciales', icon: CalendarDays, color: 'text-info' },
      { title: 'Recuperación', url: '/recuperacion/admin', icon: ClipboardCheck, color: 'text-chart-2' },
    ],
  },
  {
    label: 'Laboratorio',
    items: [
      { title: 'Laboratorio', url: '/laboratorio', icon: FlaskConical, color: 'text-info' },
      { title: 'Reporte Final', url: '/reporte-estudiantes', icon: FileText, color: 'text-chart-5' },
    ],
  },
  {
    label: 'Recursos',
    items: [
      { title: 'Clases Grabadas', url: '/clases-grabadas', icon: Video, color: 'text-chart-5' },
    ],
  },
]

const ESTUDIANTE_NAV: NavGroup[] = [
  {
    label: 'Principal',
    items: [
      { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, color: 'text-chart-2' },
      { title: 'Mi Perfil', url: '/mi-perfil', icon: User, color: 'text-chart-1' },
    ],
  },
  {
    label: 'Académico',
    items: [
      { title: 'Mis Asistencias', url: '/mis-asistencias', icon: History, color: 'text-chart-3' },
      { title: 'Prácticas', url: '/practicas', icon: Code, color: 'text-info' },
      { title: 'Recuperación', url: '/recuperacion', icon: ClipboardCheck, color: 'text-chart-2' },
      { title: 'Clases Grabadas', url: '/clases-grabadas', icon: Video, color: 'text-chart-5' },
    ],
  },
]

const DELEGADO_GROUP: NavGroup = {
  label: 'Delegado',
  items: [{ title: 'Actividades', url: '/mis-actividades', icon: Activity, color: 'text-chart-4' }],
}

const FALLBACK_NAV: NavGroup[] = [
  {
    label: 'Principal',
    items: [{ title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, color: 'text-chart-2' }],
  },
]
export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { setOpenMobile } = useSidebar()
  const [userRole, setUserRole] = React.useState<Role | null>(null)
  const [userName, setUserName] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false

    const fetchUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session || cancelled) return

      // Actualización optimista mientras llega el rol real.
      setUserName(session.user.email?.split('@')[0] || 'Usuario')

      const { data: roleData } = await supabase
        .from('usuarios_roles')
        .select('rol')
        .eq('user_id', session.user.id)
        .single()

      if (cancelled || !roleData) return

      const role = roleData.rol as Role
      setUserRole(role)

      if (role === 'estudiante' || role === 'delegado') {
        const { data: studentData } = await supabase
          .from('estudiantes')
          .select('nombre, apellido')
          .eq('user_id', session.user.id)
          .single()
        if (!cancelled && studentData) {
          setUserName(`${studentData.nombre} ${studentData.apellido}`)
        }
      } else if (role === 'auxiliar') {
        setUserName('Docente / Auxiliar')
      }
    }

    fetchUser()
    return () => {
      cancelled = true
    }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  /** Activo si la ruta coincide exactamente o si es prefijo de la actual. */
  const isItemActive = (url: string) => {
    const base = url.split('?')[0]
    if (base === '/dashboard') return pathname === '/dashboard' || pathname === '/'
    return pathname === base || pathname.startsWith(`${base}/`)
  }

  const navGroups = React.useMemo<NavGroup[]>(() => {
    if (userRole === 'auxiliar') return AUXILIAR_NAV
    if (userRole === 'estudiante') return ESTUDIANTE_NAV
    if (userRole === 'delegado') return [...ESTUDIANTE_NAV, DELEGADO_GROUP]
    return FALLBACK_NAV
  }, [userRole])
  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/50 bg-sidebar py-4">
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground shadow-lg shadow-primary/25">
            S
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <span className="text-lg font-bold leading-none tracking-tight">Sentri</span>
            <div className="mt-1 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-chart-4" aria-hidden="true" />
              <span className="text-xs font-medium text-sidebar-foreground/50">
                Sistema Académico
              </span>
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0 py-2">
        <nav aria-label="Navegación principal">
          {navGroups.map((group, index) => (
            <SidebarGroup
              key={group.label}
              className={index !== 0 ? 'mt-2 border-t border-sidebar-border/50 pt-2' : ''}
            >
              <SidebarGroupLabel className="label-caps mb-2 px-4 text-sidebar-foreground/40">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const active = isItemActive(item.url)
                    return (
                      <SidebarMenuItem key={`${group.label}-${item.title}`}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          onClick={() => setOpenMobile(false)}
                          tooltip={item.title}
                          className="relative min-h-11 rounded-xl border border-transparent transition-all duration-200 hover:bg-sidebar-accent/70 data-[active=true]:border-sidebar-primary/25 data-[active=true]:bg-sidebar-primary/12 data-[active=true]:font-semibold data-[active=true]:text-sidebar-foreground md:min-h-9 dark:data-[active=true]:bg-sidebar-primary/18"
                        >
                          <Link
                            href={item.url}
                            aria-current={active ? 'page' : undefined}
                            className="flex items-center gap-3 px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                          >
                            <item.icon
                              className={`h-4 w-4 shrink-0 ${active ? 'text-sidebar-primary' : item.color}`}
                              aria-hidden="true"
                            />
                            <span className="truncate">{item.title}</span>
                            {active && (
                              <span
                                className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-sidebar-primary"
                                aria-hidden="true"
                              />
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </nav>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/50 p-4 group-data-[collapsible=icon]:p-2">
        {userName && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-sidebar-border/30 bg-sidebar-accent/30 p-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:justify-center">
            <div className="flex min-w-0 items-center gap-3 group-data-[collapsible=icon]:hidden">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-md">
                {userName
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-sidebar-foreground">{userName}</p>
                <p className="mt-0.5 text-xs font-medium capitalize text-sidebar-foreground/60">
                  {userRole ?? 'usuario'}
                </p>
              </div>
            </div>
            <SidebarMenuButton
              onClick={handleLogout}
              tooltip="Cerrar sesión"
              variant="outline"
              aria-label="Cerrar sesión"
              className="h-9 w-9 shrink-0 rounded-xl p-0 text-sidebar-foreground/60 transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
            </SidebarMenuButton>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}