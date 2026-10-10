import { Loader2 } from 'lucide-react'

export function LoadingSpinner({ size = 24, label }: { size?: number; label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8">
      <Loader2 size={size} className="animate-spin text-primary-500" />
      {label && <p className="text-sm text-neutral-500">{label}</p>}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && <div className="mb-3 text-neutral-300">{icon}</div>}
      <h3 className="text-sm font-semibold text-neutral-700">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-neutral-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-error-100 text-error-600">
        !
      </div>
      <h3 className="text-sm font-semibold text-neutral-700">Something went wrong</h3>
      <p className="mt-1 max-w-sm text-sm text-neutral-500">{message}</p>
    </div>
  )
}
