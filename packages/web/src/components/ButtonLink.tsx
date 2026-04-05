import { Link, type LinkProps } from 'react-router-dom';

interface ButtonLinkProps extends LinkProps {
  disabled?: boolean;
  disabledReason?: string | null;
}

export function ButtonLink({ className, disabled = false, disabledReason = null, children, ...props }: ButtonLinkProps) {
  const classes = className ? `c-btn ${className}` : 'c-btn';
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
