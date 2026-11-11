import type { QuestKind } from './types';

/** Черновик дерева из вставленного списка; позже его же будет заполнять ИИ-разбиение (tech-spec). */
export type QuestDraft = { title: string; children: QuestDraft[] };
export type DraftKind = Exclude<QuestKind, 'line'>;

export type ParsedList = {
  drafts: QuestDraft[];
  /** Были строки глубже этапа — их прижали к этапу, предпросмотр об этом предупреждает. */
  flattened: boolean;
  /** Были строки длиннее 120 символов — их обрезали. */
  truncated: boolean;
};

const TITLE_MAX = 120;
const LEVELS: readonly DraftKind[] = ['chapter', 'quest', 'step'];
// Маркеры списков из заметок и чатов: «-», «*», «•», тире и нумерация «1.» или «1)»;
// пустой пункт («- ») после снятия маркера пропускается.
const MARKER = /^(?:[-*•–—]|\d+[.)])(?:\s+|$)/;

/** Вид элемента на глубине `depth` под строкой «+ Добавить …» вида `top`; `null` — глубже этапа. */
export function kindAtDepth(top: DraftKind, depth: number): DraftKind | null {
  return LEVELS[LEVELS.indexOf(top) + depth] ?? null;
}

/**
 * Каждая строка — элемент; строка с отступом (Tab, два пробела, «-» с отступом) — ребёнок
 * предыдущей, но не глубже этапа (tech-spec, «Доменная логика», правило 8).
 */
export function parseQuestList(text: string, top: DraftKind): ParsedList {
  const maxDepth = LEVELS.length - LEVELS.indexOf(top);
  const roots: QuestDraft[] = [];
  // Открытые родители: отступ строки и её черновик, от корня вниз.
  let stack: { indent: number; draft: QuestDraft }[] = [];
  let flattened = false;
  let truncated = false;

  for (const line of text.split(/\r?\n/)) {
    const indent = indentLevel(line);
    let title = line.trim().replace(MARKER, '').trim();
    if (!title) continue;
    if (title.length > TITLE_MAX) {
      title = title.slice(0, TITLE_MAX);
      truncated = true;
    }

    while (stack.length > 0 && stack.at(-1)!.indent >= indent) stack.pop();
    if (stack.length >= maxDepth) {
      // Глубже нижнего уровня: строка становится «братом» на самом нижнем доступном уровне.
      stack = stack.slice(0, maxDepth - 1);
      flattened = true;
    }

    const draft: QuestDraft = { title, children: [] };
    (stack.at(-1)?.draft.children ?? roots).push(draft);
    stack.push({ indent, draft });
  }

  return { drafts: roots, flattened, truncated };
}

/** Tab считается за два пробела; уровень — каждые два пробела. */
function indentLevel(line: string): number {
  let spaces = 0;
  for (const char of line) {
    if (char === ' ') spaces += 1;
    else if (char === '\t') spaces += 2;
    else break;
  }
  return Math.floor(spaces / 2);
}

export type DraftCount = Record<DraftKind, number> & { total: number };

/** Для фразы предпросмотра «Будет создано: 3 задания и 9 этапов». */
export function countDrafts(drafts: readonly QuestDraft[], top: DraftKind): DraftCount {
  const count: DraftCount = { chapter: 0, quest: 0, step: 0, total: 0 };
  const visit = (list: readonly QuestDraft[], depth: number) => {
    const kind = kindAtDepth(top, depth);
    if (!kind) return;
    for (const draft of list) {
      count[kind] += 1;
      count.total += 1;
      visit(draft.children, depth + 1);
    }
  };
  visit(drafts, 0);
  return count;
}
