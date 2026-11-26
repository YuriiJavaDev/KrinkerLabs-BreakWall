/**
 * What the leave window offers first: a player with a name saves and goes; one without a name who has something to lose
 * is asked for a nickname; a game with nothing in it just goes.
 */
export type LeaveFirst = 'save' | 'name' | null;

export function leaveFirst(player: string, hasProgress: boolean): LeaveFirst {
  if (!hasProgress) return null;
  return player ? 'save' : 'name';
}
