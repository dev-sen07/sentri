import { Fragment } from 'react'
import { cn } from '@/lib/utils'

/** Bloque de código: monoespaciado, conserva la sangría y hace scroll si es ancho. */
export function BloqueCodigo({ codigo, className }: { codigo: string; className?: string }) {
  return (
    <pre
      className={cn(
        'max-w-full overflow-x-auto rounded-lg border border-border bg-muted px-3 py-2 font-mono text-[13px] leading-relaxed [tab-size:4]',
        className,
      )}
    >
      <code>{codigo}</code>
    </pre>
  )
}

/** `codigo` dentro de una línea. */
function ConCodigoEnLinea({ texto }: { texto: string }) {
  return texto.split(/(`[^`\n]+`)/g).map((parte, i) =>
    /^`[^`\n]+`$/.test(parte) ? (
      <code
        key={i}
        className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]"
      >
        {parte.slice(1, -1)}
      </code>
    ) : (
      <Fragment key={i}>{parte}</Fragment>
    ),
  )
}

/**
 * Texto de una pregunta o inciso. Respeta los saltos de línea y muestra como
 * código los bloques ```...``` y los fragmentos `entre comillas invertidas`.
 * React escapa todo: un `<script>` del banco se ve como texto, no se ejecuta.
 */
export function TextoConCodigo({
  texto,
  className,
  ...resto
}: { texto: string; className?: string } & React.HTMLAttributes<HTMLDivElement> & {
    'data-enunciado'?: boolean
  }) {
  const partes = texto.split(/(```[\s\S]*?```)/g).filter((p) => p !== '')
  return (
    <div {...resto} className={cn('min-w-0 space-y-2', className)}>
      {partes.map((parte, i) => {
        const bloque = parte.match(/^```[\w+#.-]*\n?([\s\S]*?)\n?```$/)
        if (bloque) return <BloqueCodigo key={i} codigo={bloque[1]} />
        const limpio = parte.replace(/^\n+|\n+$/g, '')
        if (!limpio) return null
        return (
          <p key={i} className="whitespace-pre-wrap break-words">
            <ConCodigoEnLinea texto={limpio} />
          </p>
        )
      })}
    </div>
  )
}
