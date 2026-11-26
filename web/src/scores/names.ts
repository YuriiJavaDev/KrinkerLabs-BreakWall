// Player nicknames: the same rules as in the other KrinkerLabs games, so a name is shown the same way everywhere.

export const NAME_MAX = 18;

/** Letters, digits, spaces, _ and -; spaces collapse; upper case; up to NAME_MAX characters. Empty means no usable name. */
export const cleanName = (raw: string) =>
  String(raw || '').replace(/[^\p{L}\p{N} _-]/gu, '').replace(/ +/g, ' ').trim().toUpperCase().slice(0, NAME_MAX).trim();

// A name is folded to bare letters (look-alike Latin letters and digits become Cyrillic ones,
// separators and repeated letters vanish) and then compared with stems and with whole words.
const FOLD: Record<string, string> = { 'ё': 'е', 'й': 'и', 'і': 'и', 'ї': 'и', 'є': 'е', 'ґ': 'г', a: 'а', b: 'в', c: 'с', e: 'е', h: 'н', i: 'и', k: 'к', m: 'м', o: 'о', p: 'р', t: 'т', x: 'х', y: 'у', 0: 'о', 1: 'и', 3: 'е', 4: 'а', '@': 'а', '!': 'и' };
const fold = (s: string) => [...String(s || '').toLowerCase()].map((c) => FOLD[c] || c).join('').replace(/[^\p{L}]/gu, '').replace(/(\p{L})\1+/gu, '$1');
const STEMS = [
  'хуй', 'хуе', 'хуя', 'пизд', 'пизж', 'ебат', 'ебан', 'ебал', 'еблан', 'ебаш', 'ебуч', 'заеб', 'доеб', 'уеб', 'поеб', 'выеб', 'наеб', 'бляд', 'блят', 'мудак', 'мудил', 'пидор', 'пидар', 'пидр', 'педик',
  'гондон', 'гандон', 'залуп', 'шлюх', 'говн', 'манда', 'долбоеб', 'ублюд', 'курва', 'сука', 'суки', 'сучк', 'сучар', 'гитлер',
  'fuck', 'fuk', 'fck', 'shit', 'cunt', 'bitch', 'nigg', 'nigr', 'whore', 'slut', 'pussy', 'asshole', 'bastard', 'wanker', 'dickhead', 'blowjob', 'faggot', 'rapist', 'porn', 'hitler', 'nazi',
  'מזדיין', 'שרמוט', 'בנזונה', 'כוסאמק', 'כוסעמק', 'מניאק',
].map(fold);
const WORDS = new Set(['хер', 'бля', 'чмо', 'жопа', 'dick', 'cock', 'fag', 'anus', 'penis', 'sex', 'זין', 'כוס', 'חרא', 'זונה'].map(fold));

/** True when a name holds a swear word, in Russian, Ukrainian, English or Hebrew. A short list cannot catch everything. */
export function isRude(name: string): boolean {
  const n = fold(name);
  return WORDS.has(n) || STEMS.some((w) => n.includes(w));
}
