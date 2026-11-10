-- Тестовый пользователь для локальной разработки до этапа 6 (вход через Google).
-- id совпадает с DEV_USER_ID в apps/api/src/dev-user.ts.
INSERT INTO "user" (id, name, email)
VALUES ('dev-user', 'Dev User', 'dev-user@life-rpg.local')
ON CONFLICT (id) DO NOTHING;
