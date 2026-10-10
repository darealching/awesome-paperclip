interface StatCardProps {
  label: string
  value: string
  sublabel?: string
  trend?: 'up' | 'down' | 'neutral'
  icon?: React.ReactNode
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error'
}

export function StatCard({ label, value, sublabel, trend, icon, variant = 'default' }: StatCardProps) {
  const variantStyles = {
    default: 'text-neutral-900',
    primary: 'text-primary-700',
    success: 'text-success-700',
    warning: 'text-warning-700',
    error: 'text-error-700',
  }
  const iconBg = {
    default: 'bg-neutral-100 text-neutral-600',
    primary: 'bg-primary-50 text-primary-600',
    success: 'bg-success-50 text-success-600',
    warning: 'bg-warning-50 text-warning-600',
    error: 'bg-error-50 text-error-600',
  }

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-neutral-500">{label}</p>
        {icon && (
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconBg[variant]}`}>
            {icon}
          </div>
        )}
      </div>
      <p className={`mt-2 text-2xl font-bold ${variantStyles[variant]}`}>{value}</p>
      {sublabel && (
        <div className="mt-1 flex items-center gap-1">
          {trend === 'up' && <span className="text-xs text-success-600">&#9650;</span>}
          {trend === 'down' && <span className="text-xs text-error-600">&#9660;</span>}
          <p className="text-xs text-neutral-500">{sublabel}</p>
        </div>
      )}
    </div>
  )
}
