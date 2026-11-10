import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  customType,
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

// Базовые колонки таблицы `user` из Better Auth. Сам Better Auth подключается на этапе 6,
// а таблица нужна уже сейчас, чтобы у `quests.user_id` был настоящий внешний ключ.
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const questKind = pgEnum('quest_kind', ['line', 'chapter', 'quest', 'step']);
export const questStatus = pgEnum('quest_status', ['open', 'done', 'paused', 'cancelled']);

// Ключи fractional-indexing сравниваются побайтово (ASCII), поэтому колонке нужна
// сортировка "C": сортировка по локали, которая стоит по умолчанию, переставила бы «братьев».
const orderKey = customType<{ data: string }>({
  dataType() {
    return 'text COLLATE "C"';
  },
});

export const quests = pgTable(
  'quests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    // Корень дерева; у самой линии совпадает с её id.
    lineId: uuid('line_id').notNull(),
    parentId: uuid('parent_id').references((): AnyPgColumn => quests.id, {
      onDelete: 'cascade',
    }),
    kind: questKind('kind').notNull(),
    status: questStatus('status').notNull().default('open'),
    title: varchar('title', { length: 120 }).notNull(),
    description: text('description'),
    deadline: date('deadline', { mode: 'string' }),
    position: orderKey('position').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('quests_line_has_no_parent', sql`(${t.kind} = 'line') = (${t.parentId} IS NULL)`),
    check('quests_pause_only_line_or_chapter', sql`${t.status} <> 'paused' OR ${t.kind} IN ('line', 'chapter')`),
    index('quests_line_idx').on(t.lineId),
    index('quests_children_idx').on(t.parentId, t.position),
    index('quests_journal_idx').on(t.userId, t.kind, t.status),
  ],
);

export const userSettings = pgTable('user_settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  activeQuestId: uuid('active_quest_id').references(() => quests.id, { onDelete: 'set null' }),
  vibration: boolean('vibration').notNull().default(false),
  sound: boolean('sound').notNull().default(false),
});
