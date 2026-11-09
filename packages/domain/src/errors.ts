export type DomainErrorCode =
  /** Узел или его предок на паузе или отменён. */
  | 'branch_locked'
  /** Задание с открытыми этапами отмечают без `withChildren`: клиент показывает диалог. */
  | 'has_open_children'
  /** Такой вид нельзя вложить в такого родителя. */
  | 'invalid_parent'
  /** Действие не имеет смысла для узла, например пауза этапа. */
  | 'invalid_transition';

/** API превращает её в `409 { code }`. */
export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode) {
    super(code);
    this.name = 'DomainError';
    this.code = code;
  }
}
