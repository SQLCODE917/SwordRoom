import { Link, type LinkProps } from 'react-router-dom';

interface ButtonLinkProps extends LinkProps {
  disabled?: boolean;
  disabledReason?: string | null;
  variant?: 'default' | 'destructive';
}

export function ButtonLink({
  className,
  disabled = false,
  disabledReason = null,
  variant = 'default',
  children,
  ...props
}: ButtonLinkProps) {
  const variantClass = variant === 'destructive' ? 'c-btn--destructive' : '';
  const classes = ['c-btn', variantClass, className].filter(Boolean).join(' ');
  if (disabled) {
    return (
      <span className={classes} role="link" aria-disabled="true" tabIndex={-1} title={disabledReason ?? undefined}>
        {children}
      </span>
    );
  }

  return (
    <Link {...props} className={classes}>
      {children}
    </Link>
  );
}
