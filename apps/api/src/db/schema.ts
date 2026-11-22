import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

// Таблицы Better Auth (`user`, `session`, `account`, `verification`) — по его базовой схеме,
// но в нашей схеме Drizzle и миграциях drizzle-kit: один набор миграций, который гоняет CI.
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [index('session_user_id_idx').on(t.userId)],
);

/** Связь пользователя с аккаунтом Google; пароли не храним — колонка `password` нужна схеме Better Auth. */
export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('account_user_id_idx').on(t.userId)],
);

/** Одноразовые значения входа: state и PKCE между редиректом на Google и callback. */
export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
);

/**
 * Счётчики ограничения частоты входа. Хранилище по умолчанию — память экземпляра Better Auth,
 * а на Workers экземпляр живёт один запрос (клиент базы создаётся на запрос), и счётчик бы обнулялся.
 */
export const rateLimit = pgTable('rate_limit', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  count: integer('count').notNull(),
  lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
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
    // Расписание контракта (v2): маска дней недели (пн = 1 … вс = 64) и срок включительно.
    repeatWeekdays: smallint('repeat_weekdays'),
    repeatStart: date('repeat_start', { mode: 'string' }),
    repeatEnd: date('repeat_end', { mode: 'string' }),
    /** Дата дня у этапа контракта. */
    scheduledOn: date('scheduled_on', { mode: 'string' }),
  },
  (t) => [
    check('quests_line_has_no_parent', sql`(${t.kind} = 'line') = (${t.parentId} IS NULL)`),
    check('quests_pause_only_line_or_chapter', sql`${t.status} <> 'paused' OR ${t.kind} IN ('line', 'chapter')`),
    check(
      'quests_contract_schedule',
      sql`num_nulls(${t.repeatWeekdays}, ${t.repeatStart}, ${t.repeatEnd}) IN (0, 3)
        AND (${t.repeatWeekdays} IS NULL OR (
          ${t.kind} = 'quest' AND ${t.repeatWeekdays} BETWEEN 1 AND 127
          AND ${t.repeatEnd} >= ${t.repeatStart} AND ${t.repeatEnd} - ${t.repeatStart} <= 365))`,
    ),
    check('quests_scheduled_only_step', sql`${t.scheduledOn} IS NULL OR ${t.kind} = 'step'`),
    index('quests_line_idx').on(t.lineId),
    index('quests_children_idx').on(t.parentId, t.position),
    index('quests_journal_idx').on(t.userId, t.kind, t.status),
    // Один день на дату: повтор PUT расписания из очереди без сети не создаст дубль.
    uniqueIndex('quests_contract_day_idx')
      .on(t.parentId, t.scheduledOn)
      .where(sql`${t.scheduledOn} IS NOT NULL`),
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
