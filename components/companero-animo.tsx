import { cn } from '@/lib/utils'

/** Cuerpo de cada personaje, en un lienzo de 64x64. El color sale de currentColor. */
const PERSONAJES = [
  {
    nombre: 'Bit',
    color: 'text-chart-1',
    cuerpo: (
      <>
        <line x1="32" y1="17" x2="32" y2="8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <circle cx="32" cy="7" r="3.5" fill="currentColor" />
        <rect x="12" y="17" width="40" height="38" rx="11" fill="currentColor" />
        <rect x="6" y="30" width="6" height="12" rx="3" fill="currentColor" />
        <rect x="52" y="30" width="6" height="12" rx="3" fill="currentColor" />
      </>
    ),
  },
  {
    nombre: 'Nubi',
    color: 'text-chart-2',
    cuerpo: (
      <>
        <circle cx="19" cy="38" r="13" fill="currentColor" />
        <circle cx="45" cy="38" r="13" fill="currentColor" />
        <circle cx="32" cy="27" r="17" fill="currentColor" />
        <rect x="19" y="34" width="26" height="17" fill="currentColor" />
      </>
    ),
  },
  {
    nombre: 'Gota',
    color: 'text-chart-3',
    cuerpo: (
      <path
        d="M32 5 C32 5 54 28 54 39 C54 50 44 58 32 58 C20 58 10 50 10 39 C10 28 32 5 32 5 Z"
        fill="currentColor"
      />
    ),
  },
  {
    nombre: 'Chispa',
    color: 'text-chart-4',
    cuerpo: (
      <>
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angulo) => (
          <rect
            key={angulo}
            x="29.5"
            y="3"
            width="5"
            height="12"
            rx="2.5"
            fill="currentColor"
            transform={`rotate(${angulo} 32 34)`}
          />
        ))}
        <circle cx="32" cy="34" r="20" fill="currentColor" />
      </>
    ),
  },
] as const

function Cara({ feliz }: { feliz: boolean }) {
  if (feliz) {
    return (
      <g fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
        <path d="M21 35 Q25 29 29 35" />
        <path d="M35 35 Q39 29 43 35" />
        <path d="M23 41 Q32 51 41 41" />
      </g>
    )
  }
  return (
    <>
      <g
        fill="white"
        className="origin-center animate-[comp-parpadeo_4.5s_ease-in-out_infinite] [transform-box:fill-box]"
      >
        <circle cx="25" cy="33" r="4.5" />
        <circle cx="39" cy="33" r="4.5" />
      </g>
      <circle cx="26" cy="33" r="2" fill="#1f1f33" />
      <circle cx="40" cy="33" r="2" fill="#1f1f33" />
      <path d="M26 43 Q32 47 38 43" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" />
    </>
  )
}

/**
 * Personaje que acompana cada pregunta. `indice` elige cual; `feliz` lo hace
 * saltar. Cambia la `key` del padre para repetir el salto.
 *
 * Es decoracion: las animaciones las apaga prefers-reduced-motion en globals.css.
 */
export function CompaneroAnimo({
  indice,
  feliz = false,
  className,
}: {
  indice: number
  feliz?: boolean
  className?: string
}) {
  const personaje = PERSONAJES[indice % PERSONAJES.length]
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={cn('shrink-0 overflow-visible', personaje.color, className)}
    >
      <g
        className={cn(
          'origin-bottom [transform-box:fill-box]',
          feliz
            ? 'animate-[comp-salto_0.6s_ease-in-out]'
            : 'animate-[comp-flotar_3.2s_ease-in-out_infinite]',
        )}
      >
        {personaje.cuerpo}
        <Cara feliz={feliz} />
      </g>
    </svg>
  )
}

/** Confeti de celebracion. Las posiciones son fijas para que el render sea puro. */
export function Confeti() {
  const colores = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5']
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 28 }, (_, i) => (
        <span
          key={i}
          className={cn(
            'absolute top-0 h-2.5 w-1.5 rounded-sm opacity-0 animate-[comp-confeti_2.6s_ease-in_forwards]',
            colores[i % colores.length],
          )}
          style={{
            left: `${(i * 37) % 100}%`,
            animationDelay: `${((i * 53) % 90) / 100}s`,
          }}
        />
      ))}
    </div>
  )
}
