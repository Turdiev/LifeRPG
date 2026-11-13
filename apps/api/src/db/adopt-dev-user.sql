-- Разовый перенос локальных данных `dev-user` (этапы 3–5, до входа через Google) на твой аккаунт.
-- Запуск: `pnpm db:adopt-dev-user` после первого входа через Google, только для локальной базы.
-- Аккаунт выбирается сам: кроме `dev-user` в локальной базе должен быть ровно один пользователь.
DO $$
DECLARE
  target text;
  others integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "user" WHERE id = 'dev-user') THEN
    RAISE NOTICE 'dev-user нет: данные уже перенесены или их не было';
    RETURN;
  END IF;

  SELECT count(*) INTO others FROM "user" WHERE id <> 'dev-user';
  IF others <> 1 THEN
    RAISE EXCEPTION 'Кроме dev-user должен быть ровно один пользователь, а их %. Сначала войди через Google один раз.', others;
  END IF;
  SELECT id INTO target FROM "user" WHERE id <> 'dev-user';

  UPDATE quests SET user_id = target WHERE user_id = 'dev-user';
  -- Настройки dev-user (с активным квестом) заменяют пустые, созданные при первом входе.
  IF EXISTS (SELECT 1 FROM user_settings WHERE user_id = 'dev-user') THEN
    DELETE FROM user_settings WHERE user_id = target;
    UPDATE user_settings SET user_id = target WHERE user_id = 'dev-user';
  END IF;
  DELETE FROM "user" WHERE id = 'dev-user';

  RAISE NOTICE 'Данные dev-user перенесены на пользователя %', target;
END $$;
