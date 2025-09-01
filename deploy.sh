#!/bin/bash

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция для печати цветных сообщений
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Проверка наличия .env файла
check_env_file() {
    if [ ! -f ".env" ]; then
        print_error "Файл .env не найден!"
        print_status "Создайте файл .env со следующими переменными:"
        echo "BOT_TOKEN=your_telegram_bot_token"
        echo "DATABASE_URL=postgresql://cbr_user:cbr_password@postgres:5432/cbr_bot"
        echo "FIRECRAWL_API_KEY=your_firecrawl_api_key"
        echo "CLAUDE_API_KEY=your_claude_api_key"
        echo "MONITORING_INTERVAL=2700000"
        echo "ADMIN_USER_IDS=1856156198,145328014"
        echo "LOG_LEVEL=info"
        exit 1
    fi
    print_success "Файл .env найден"
}

# Проверка Docker и Docker Compose
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker не установлен!"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose не установлен!"
        exit 1
    fi
    print_success "Docker и Docker Compose доступны"
}

# Сборка приложения
build_app() {
    print_status "Собираем TypeScript..."
    npm run build
    if [ $? -eq 0 ]; then
        print_success "TypeScript собран успешно"
    else
        print_error "Ошибка сборки TypeScript"
        exit 1
    fi
}

# Остановка старых контейнеров
stop_containers() {
    print_status "Останавливаем старые контейнеры..."
    docker-compose down
    print_success "Контейнеры остановлены"
}

# Пересборка и запуск контейнеров
start_containers() {
    print_status "Пересобираем и запускаем контейнеры..."
    docker-compose build --no-cache
    docker-compose up -d
    
    if [ $? -eq 0 ]; then
        print_success "Контейнеры запущены успешно"
    else
        print_error "Ошибка запуска контейнеров"
        exit 1
    fi
}

# Проверка статуса контейнеров
check_containers() {
    print_status "Проверяем статус контейнеров..."
    sleep 10
    
    # Проверяем PostgreSQL
    if docker-compose ps postgres | grep -q "Up"; then
        print_success "PostgreSQL контейнер работает"
    else
        print_error "PostgreSQL контейнер не запущен"
        return 1
    fi
    
    # Проверяем основное приложение
    if docker-compose ps cbr-bot | grep -q "Up"; then
        print_success "CBR Bot контейнер работает"
    else
        print_error "CBR Bot контейнер не запущен"
        return 1
    fi
}

# Показ логов
show_logs() {
    print_status "Показываем логи последних 50 строк..."
    docker-compose logs --tail=50 cbr-bot
}

# Мониторинг логов
monitor_logs() {
    print_status "Мониторинг логов (Ctrl+C для выхода)..."
    docker-compose logs -f cbr-bot
}

# Главное меню
main_menu() {
    echo ""
    echo "🤖 CBR Monitoring Bot - Скрипт деплоя"
    echo "======================================"
    echo "1) 🚀 Полный деплой (остановка + пересборка + запуск)"
    echo "2) 📦 Только пересборка и запуск"
    echo "3) ⏹️  Остановить контейнеры"
    echo "4) ▶️  Запустить контейнеры"
    echo "5) 📊 Проверить статус"
    echo "6) 📝 Показать логи"
    echo "7) 🔍 Мониторинг логов"
    echo "8) 🧹 Очистить логи"
    echo "9) ❌ Выход"
    echo ""
    read -p "Выберите опцию [1-9]: " choice
    
    case $choice in
        1)
            print_status "Начинаем полный деплой..."
            check_env_file
            check_docker
            build_app
            stop_containers
            start_containers
            check_containers
            show_logs
            ;;
        2)
            print_status "Пересборка и запуск..."
            check_env_file
            check_docker
            build_app
            start_containers
            check_containers
            ;;
        3)
            stop_containers
            ;;
        4)
            print_status "Запуск контейнеров..."
            docker-compose up -d
            check_containers
            ;;
        5)
            print_status "Статус контейнеров:"
            docker-compose ps
            ;;
        6)
            show_logs
            ;;
        7)
            monitor_logs
            ;;
        8)
            print_status "Очищаем логи..."
            > logs/error.log
            > logs/combined.log
            print_success "Логи очищены"
            ;;
        9)
            print_status "До свидания!"
            exit 0
            ;;
        *)
            print_error "Неверный выбор. Попробуйте снова."
            main_menu
            ;;
    esac
}

# Проверка аргументов командной строки
if [ $# -eq 0 ]; then
    main_menu
else
    case $1 in
        deploy)
            check_env_file
            check_docker
            build_app
            stop_containers
            start_containers
            check_containers
            show_logs
            ;;
        start)
            docker-compose up -d
            check_containers
            ;;
        stop)
            stop_containers
            ;;
        logs)
            show_logs
            ;;
        status)
            docker-compose ps
            ;;
        *)
            echo "Использование: $0 [deploy|start|stop|logs|status]"
            echo "Или запустите без параметров для интерактивного меню"
            exit 1
            ;;
    esac
fi
