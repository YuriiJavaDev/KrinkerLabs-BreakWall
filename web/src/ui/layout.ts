/**
 * The phone layout: a narrow window, a low one (a phone held sideways), or a tablet held upright, where side panels
 * would leave the table too narrow. Everything about it hangs on this one rule.
 */
export const COMPACT_MAX_WIDTH = 760;
export const COMPACT_MAX_HEIGHT = 520;
export const UPRIGHT_TABLET_MAX_WIDTH = 1100;
export const COMPACT_QUERY = `(max-width: ${COMPACT_MAX_WIDTH}px), (max-height: ${COMPACT_MAX_HEIGHT}px), (orientation: portrait) and (max-width: ${UPRIGHT_TABLET_MAX_WIDTH}px)`;

export function isCompact(width: number, height: number): boolean {
  return width <= COMPACT_MAX_WIDTH || height <= COMPACT_MAX_HEIGHT || (height >= width && width <= UPRIGHT_TABLET_MAX_WIDTH);
}

/** Moves blocks of the desktop screen into named slots of the menu on a phone, and back. */
export function mover(blocks: [HTMLElement, HTMLElement][]) {
  const home = blocks.map(([el]) => ({ el, parent: el.parentElement!, next: el.nextSibling }));
  return (compact: boolean) => {
    if (compact) blocks.forEach(([el, slot]) => slot.appendChild(el));
    else home.forEach(({ el, parent, next }) => parent.insertBefore(el, next && next.parentNode === parent ? next : null));
  };
}
