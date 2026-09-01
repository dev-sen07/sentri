'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
// Tabs: using custom underline style (see marcar-asistencia pattern)
import Link from 'next/link'
import {
  Users, CheckSquare, History, Code, User, LayoutDashboard,
  BookOpen, FileUp, FileText, GraduationCap, Star, Video,
  BarChart2, FlaskConical,
} from 'lucide-react'

/* ─────────────────────────────────────────────────────────────────
   TABS AUXILIAR
   3 tabs: General · Laboratorio · Reportes
───────────────────────────────────────────────────────────────── */
const AUXILIAR_TABS = [
  {
    id: 'general',
    label: 'General',
    icon: LayoutDashboard,
    cards: [
      {
        title: 'Estudiantes',
        description: 'Ver y gestionar la lista de estudiantes registrados',
        href: '/estudiantes',
        icon: Users,
        gradient: 'from-blue-500/20 to-indigo-500/10',
        border: 'border-blue-200 dark:border-blue-900',
        iconColor: 'text-blue-600 dark:text-blue-400',
        iconBg: 'bg-blue-100 dark:bg-blue-900/40',
      },
      {
        title: 'Marcar Asistencia',
        description: 'Registrar la asistencia del día para los estudiantes',
        href: '/marcar-asistencia',
        icon: CheckSquare,
        gradient: 'from-emerald-500/20 to-green-500/10',
        border: 'border-emerald-200 dark:border-emerald-900',
        iconColor: 'text-emerald-600 dark:text-emerald-400',
        iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
      },
      {
        title: 'Extras',
        description: 'Asignar puntos adicionales por mérito a estudiantes',
        href: '/extras',
        icon: Star,
        gradient: 'from-yellow-500/20 to-amber-500/10',
        border: 'border-yellow-200 dark:border-yellow-900',
        iconColor: 'text-yellow-600 dark:text-yellow-400',
        iconBg: 'bg-yellow-100 dark:bg-yellow-900/40',
      },
      {
        title: 'Clases Grabadas',
        description: 'Gestionar el repositorio de videos de clase',
        href: '/clases-grabadas',
        icon: Video,
        gradient: 'from-sky-500/20 to-blue-500/10',
        border: 'border-sky-200 dark:border-sky-900',
        iconColor: 'text-sky-600 dark:text-sky-400',
        iconBg: 'bg-sky-100 dark:bg-sky-900/40',
      },
    ],
  },
  {
    id: 'laboratorio',
    label: 'Laboratorio',
    icon: FlaskConical,
    cards: [
      {
        title: 'Ver Prácticas',
        description: 'Gestionar ejercicios Python y revisar entregas de código',
        href: '/laboratorio?tab=practicas',
        icon: BookOpen,
        gradient: 'from-orange-500/20 to-amber-500/10',
        border: 'border-orange-200 dark:border-orange-900',
        iconColor: 'text-orange-600 dark:text-orange-400',
        iconBg: 'bg-orange-100 dark:bg-orange-900/40',
      },
      {
        title: 'Presentaciones',
        description: 'Revisar y calificar archivos entregados por estudiantes',
        href: '/laboratorio?tab=presentar-practicas',
        icon: FileUp,
        gradient: 'from-teal-500/20 to-cyan-500/10',
        border: 'border-teal-200 dark:border-teal-900',
        iconColor: 'text-teal-600 dark:text-teal-400',
        iconBg: 'bg-teal-100 dark:bg-teal-900/40',
      },
      {
        title: 'Liberación',
        description: 'Gestionar el examen de liberación semestral',
        href: '/laboratorio?tab=liberacion',
        icon: GraduationCap,
        gradient: 'from-violet-500/20 to-purple-500/10',
        border: 'border-violet-200 dark:border-violet-900',
        iconColor: 'text-violet-600 dark:text-violet-400',
        iconBg: 'bg-violet-100 dark:bg-violet-900/40',
      },
    ],
  },
  {
    id: 'reportes',
    label: 'Reportes',
    icon: BarChart2,
    cards: [
      {
        title: 'Reporte Final',
        description: 'Exportar lista de estudiantes y notas a Excel',
        href: '/reporte-estudiantes',
        icon: FileText,
        gradient: 'from-pink-500/20 to-rose-500/10',
        border: 'border-pink-200 dark:border-pink-900',
        iconColor: 'text-pink-600 dark:text-pink-400',
        iconBg: 'bg-pink-100 dark:bg-pink-900/40',
      },
      {
        title: 'Reporte Liberación',
        description: 'Exportar notas del examen de liberación a Excel',
        href: '/reporte-liberacion',
        icon: GraduationCap,
        gradient: 'from-amber-500/20 to-orange-500/10',
        border: 'border-amber-200 dark:border-amber-900',
        iconColor: 'text-amber-600 dark:text-amber-400',
        iconBg: 'bg-amber-100 dark:bg-amber-900/40',
      },
    ],
  },
]

/* ─────────────────────────────────────────────────────────────────
   TABS ESTUDIANTE
   2 tabs: General · Laboratorio
───────────────────────────────────────────────────────────────── */
const ESTUDIANTE_TABS = [
  {
    id: 'general',
    label: 'General',
    icon: LayoutDashboard,
    cards: [
      {
        title: 'Mis Asistencias',
        description: 'Consulta tu historial de asistencia',
        href: '/mis-asistencias',
        icon: History,
        gradient: 'from-violet-500/20 to-purple-500/10',
        border: 'border-violet-200 dark:border-violet-900',
        iconColor: 'text-violet-600 dark:text-violet-400',
        iconBg: 'bg-violet-100 dark:bg-violet-900/40',
      },
      {
        title: 'Clases Grabadas',
        description: 'Accede al repositorio de videos de clase',
        href: '/clases-grabadas',
        icon: Video,
        gradient: 'from-sky-500/20 to-blue-500/10',
        border: 'border-sky-200 dark:border-sky-900',
        iconColor: 'text-sky-600 dark:text-sky-400',
        iconBg: 'bg-sky-100 dark:bg-sky-900/40',
      },
      {
        title: 'Mi Perfil',
        description: 'Ver tu información personal y datos académicos',
        href: '/mi-perfil',
        icon: User,
        gradient: 'from-pink-500/20 to-rose-500/10',
        border: 'border-pink-200 dark:border-pink-900',
        iconColor: 'text-pink-600 dark:text-pink-400',
        iconBg: 'bg-pink-100 dark:bg-pink-900/40',
      },
    ],
  },
  {
    id: 'laboratorio',
    label: 'Laboratorio',
    icon: FlaskConical,
    cards: [
      {
        title: 'Prácticas',
        description: 'Resuelve los ejercicios de programación asignados',
        href: '/laboratorio?tab=practicas',
        icon: Code,
        gradient: 'from-indigo-500/20 to-blue-500/10',
        border: 'border-indigo-200 dark:border-indigo-900',
        iconColor: 'text-indigo-600 dark:text-indigo-400',
        iconBg: 'bg-indigo-100 dark:bg-indigo-900/40',
      },
      {
        title: 'Presentar Prácticas',
        description: 'Sube tus archivos de prácticas para revisión',
        href: '/laboratorio?tab=presentar-practicas',
        icon: FileUp,
        gradient: 'from-teal-500/20 to-cyan-500/10',
        border: 'border-teal-200 dark:border-teal-900',
        iconColor: 'text-teal-600 dark:text-teal-400',
        iconBg: 'bg-teal-100 dark:bg-teal-900/40',
      },
      {
        title: 'Liberación',
        description: 'Accede al examen de liberación semestral',
        href: '/laboratorio?tab=liberacion',
        icon: GraduationCap,
        gradient: 'from-amber-500/20 to-orange-500/10',
        border: 'border-amber-200 dark:border-amber-900',
        iconColor: 'text-amber-600 dark:text-amber-400',
        iconBg: 'bg-amber-100 dark:bg-amber-900/40',
      },
    ],
  },
]

/* ─────────────────────────────────────────────────────────────────
   NAV CARD
───────────────────────────────────────────────────────────────── */
type CardDef = {
  title: string
  description: string
  href: string
  icon: React.ElementType
  gradient: string
  border: string
  iconColor: string
  iconBg: string
}

function NavCard({ card }: { card: CardDef }) {
  return (
    <Link href={card.href}>
      <Card
        className={`group h-full transition-all duration-200 hover:shadow-lg hover:-translate-y-1 cursor-pointer bg-gradient-to-br ${card.gradient} ${card.border} border`}
      >
        <CardHeader className="pb-3">
          <div
            className={`w-12 h-12 rounded-xl ${card.iconBg} flex items-center justify-center mb-3 transition-transform duration-200 group-hover:scale-110`}
          >
            <card.icon className={`w-6 h-6 ${card.iconColor}`} />
          </div>
          <CardTitle className="text-base">{card.title}</CardTitle>
          <CardDescription className="text-sm">{card.description}</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Button variant="secondary" className="w-full font-medium text-sm" size="sm">
            Ir ahora →
          </Button>
        </CardContent>
      </Card>
    </Link>
  )
}

/* ─────────────────────────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const router = useRouter()
  const [userRole, setUserRole] = useState<'estudiante' | 'auxiliar' | 'delegado' | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>('')

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { router.push('/login'); return }

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
              .select('nombre')
              .eq('user_id', session.user.id)
              .single()
            if (studentData) {
              setUserName(studentData.nombre)
            } else {
              setUserName(session.user.email?.split('@')[0] || 'Estudiante')
            }
          } else if (role === 'auxiliar') {
            setUserName('Docente / Auxiliar')
          }
        } else {
          setUserName(session.user.email?.split('@')[0] || 'Usuario')
        }
        setLoading(false)
      } catch (error) {
        console.error('Error checking auth:', error)
        router.push('/login')
      }
    }
    checkUser()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          <p className="text-muted-foreground animate-pulse">Cargando...</p>
        </div>
      </div>
    )
  }

  const tabs = userRole === 'auxiliar' ? AUXILIAR_TABS : ESTUDIANTE_TABS

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid gap-8">

          {/* Hero / Welcome Banner */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-violet-600 to-indigo-700 p-8 text-white shadow-xl">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_oklch(0.90_0.10_310/0.25)_0%,_transparent_60%)]" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <LayoutDashboard className="w-6 h-6" />
                </div>
                <span className="text-white/70 text-sm font-medium uppercase tracking-widest">Dashboard</span>
              </div>
              <h1 className="text-4xl font-bold mb-2">
                ¡Hola, <span className="text-yellow-300">{userName}</span>! 👋
              </h1>
              <p className="text-white/80 text-lg">
                {userRole === 'auxiliar'
                  ? 'Gestiona estudiantes, asistencias y prácticas desde aquí.'
                  : 'Consulta tus registros y resuelve las prácticas asignadas.'}
              </p>
              <div className="mt-4 inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium border border-white/30">
                <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                {userRole === 'auxiliar'
                  ? 'Auxiliar de Laboratorio'
                  : userRole === 'delegado' ? 'Delegado' : 'Estudiante'}
              </div>
            </div>
          </div>

          {/* Tabbed Navigation */}
          <div>
            <h2 className="text-lg font-semibold mb-4 text-muted-foreground">Acceso Rápido</h2>

            {/* Tab triggers */}
            <div className="flex gap-0 border-b border-border mb-6 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 sm:px-5 py-2.5 font-medium text-sm transition-colors flex items-center gap-2 border-b-2 -mb-px shrink-0 ${
                    (activeTab || tabs[0].id) === tab.id
                      ? 'text-primary border-primary'
                      : 'text-muted-foreground border-transparent hover:text-foreground'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  <span className="ml-1 text-xs opacity-50">({tab.cards.length})</span>
                </button>
              ))}
            </div>

            {/* Tab contents */}
            {tabs.map((tab) => (
              (activeTab || tabs[0].id) === tab.id && (
                <div key={tab.id} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {tab.cards.map((card) => (
                    <NavCard key={card.href} card={card} />
                  ))}
                </div>
              )
            ))}
          </div>

        </div>
      </main>
    </div>
  )
}
