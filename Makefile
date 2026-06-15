.PHONY: env install dev build db db-stop db-shell docker-up docker-down docker-build logs clean setup backup backup-local help

# ── Первичная настройка ────────────────────────────────────────────
## Скопировать .env.example → .env (не перезаписывает если уже есть)
env:
	@if [ -f .env ]; then \
		echo ".env уже существует, пропускаю"; \
	else \
		cp .env.example .env && echo ".env создан из .env.example"; \
	fi

## Установить зависимости
install:
	npm install

## Полная первичная настройка: env + install + запуск БД
setup: env install db
	@echo ""
	@echo "Готово! Запусти: make dev"

# ── Разработка ─────────────────────────────────────────────────────
## Запустить dev-сервер (Vite + API вместе)
dev:
	npm run dev

## Собрать production-билд
build:
	npm run build

# ── База данных (Docker) ────────────────────────────────────────────
## Запустить только PostgreSQL в фоне
db:
	docker compose up db -d

## Остановить PostgreSQL
db-stop:
	docker compose stop db

## Подключиться к БД через psql
db-shell:
	docker compose exec db psql -U dikanish -d dikanish

# ── Docker (полный стек) ────────────────────────────────────────────
## Собрать и запустить всё (app + db) через Docker
docker-up:
	docker compose up --build -d

## Остановить и удалить контейнеры
docker-down:
	docker compose down

## Только пересобрать образ
docker-build:
	docker compose build

## Логи приложения в Docker
logs:
	docker compose logs -f app

# ── Резервные копии ────────────────────────────────────────────
## Бэкап БД через Docker (для локальной разработки)
backup-local:
	@mkdir -p backups
	docker compose exec db pg_dump -U dikanish dikanish | gzip > backups/backup_$(shell date +%Y%m%d_%H%M%S).sql.gz
	@echo "Готово: backups/backup_$(shell date +%Y%m%d_%H%M%S).sql.gz"

## Бэкап через pg_dump (для VPS с DATABASE_URL в .env)
backup:
	@bash scripts/backup.sh

# ── Прочее ─────────────────────────────────────────────────────────
## Удалить dist/ и node_modules/
clean:
	rm -rf dist node_modules

## Показать список доступных команд
help:
	@echo ""
	@echo "  make env          — создать .env из .env.example"
	@echo "  make install      — npm install"
	@echo "  make setup        — env + install + запуск БД (первый раз)"
	@echo "  make dev          — запустить локально (Vite + API)"
	@echo "  make build        — собрать production-билд"
	@echo "  make db           — запустить PostgreSQL (Docker, фон)"
	@echo "  make db-stop      — остановить PostgreSQL"
	@echo "  make db-shell     — psql в контейнере"
	@echo "  make docker-up    — поднять весь стек через Docker"
	@echo "  make docker-down  — остановить Docker-стек"
	@echo "  make logs         — логи app-контейнера"
	@echo "  make backup-local — бэкап БД через Docker (локально)"
	@echo "  make backup       — бэкап БД через pg_dump (.env / VPS)"
	@echo "  make clean        — удалить dist/ и node_modules/"
	@echo ""
