import { Link, type LinkProps } from 'react-router-dom';

export function ButtonLink({ className, ...props }: LinkProps) {
  return <Link {...props} className={className ? `c-btn ${className}` : 'c-btn'} />;
}
