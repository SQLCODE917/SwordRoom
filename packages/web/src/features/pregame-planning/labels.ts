import type { PregameRole } from '@starter/shared';

export const PREGAME_ROLE_LABELS: Record<PregameRole, string> = {
  FRONTLINE: 'Frontline',
  HEALER: 'Healer',
  SCOUT: 'Scout',
  ARCANE: 'Arcane Support',
};

export const PREGAME_ROLE_ORDER: PregameRole[] = ['FRONTLINE', 'HEALER', 'SCOUT', 'ARCANE'];

export function formatPregameRoleList(roles: readonly PregameRole[]): string {
  if (roles.length === 0) {
    return 'the party';
  }
  const labels = roles.map((role) => PREGAME_ROLE_LABELS[role]);
  if (labels.length === 1) {
    return labels[0]!;
  }
  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`;
  }
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}
