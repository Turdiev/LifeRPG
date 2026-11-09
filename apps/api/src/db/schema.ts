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

// Base columns of the Better Auth `user` table. Better Auth itself is wired in at
// stage 6; the table exists now so that `quests.user_id` can have a real foreign key.
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

// fractional-indexing keys compare bytewise (ASCII), so the column must use the "C"
// collation; the default locale-aware collation would order siblings differently.
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
    // Root of the tree; for a line it equals its own id.
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
