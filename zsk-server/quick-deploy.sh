#!/bin/bash

echo "🚀 ZSK Прокси - Быстрое развертывание на сервере"
echo "=============================================="

# Проверяем что мы на Linux сервере
if [[ ! "$OSTYPE" == "linux-gnu"* ]]; then
    echo "❌ Этот скрипт предназначен для Linux серверов"
    exit 1
fi

# Определяем IP сервера
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null || hostname -I | awk '{print $1}')

echo "📡 IP сервера: $SERVER_IP"
echo ""

# Генерируем случайный пароль
PROXY_USER="proxy_user"
PROXY_PASS=$(openssl rand -base64 12)

echo "🔑 Создаем пользователя прокси:"
echo "   Пользователь: $PROXY_USER"
echo "   Пароль: $PROXY_PASS"
echo ""

# Устанавливаем nginx
echo "📦 Устанавливаем nginx..."
if command -v apt-get &> /dev/null; then
    sudo apt-get update > /dev/null 2>&1
    sudo apt-get install -y nginx apache2-utils > /dev/null 2>&1
    echo "✅ nginx установлен (Ubuntu/Debian)"
elif command -v yum &> /dev/null; then
    sudo yum install -y nginx httpd-tools > /dev/null 2>&1
    echo "✅ nginx установлен (CentOS/RHEL)"
else
    echo "❌ Неподдерживаемый дистрибутив Linux"
    exit 1
fi

# Создаем файл паролей
echo "🔐 Создаем файл паролей..."
sudo htpasswd -cb /etc/nginx/.htpasswd $PROXY_USER $PROXY_PASS

# Бекапим оригинальный конфиг
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup

# Копируем наш конфиг
echo "⚙️ Устанавливаем конфигурацию..."
sudo cp nginx.conf /etc/nginx/nginx.conf

# Проверяем конфигурацию
echo "🔍 Проверяем конфигурацию nginx..."
if sudo nginx -t > /dev/null 2>&1; then
    echo "✅ Конфигурация корректна"
else
    echo "❌ Ошибка в конфигурации nginx"
    sudo nginx -t
    echo "🔄 Восстанавливаем оригинальную конфигурацию..."
    sudo cp /etc/nginx/nginx.conf.backup /etc/nginx/nginx.conf
    exit 1
fi

# Запускаем nginx
echo "🚀 Запускаем nginx..."
sudo systemctl start nginx
sudo systemctl enable nginx

# Открываем порт в firewall (если установлен)
if command -v ufw &> /dev/null; then
    echo "🛡️ Открываем порт 8888 в UFW..."
    sudo ufw allow 8888 > /dev/null 2>&1
elif command -v firewall-cmd &> /dev/null; then
    echo "🛡️ Открываем порт 8888 в firewalld..."
    sudo firewall-cmd --permanent --add-port=8888/tcp > /dev/null 2>&1
    sudo firewall-cmd --reload > /dev/null 2>&1
fi

# Проверяем что nginx запущен
sleep 2
if sudo systemctl is-active --quiet nginx; then
    echo "✅ nginx запущен успешно"
else
    echo "❌ Ошибка запуска nginx"
    sudo systemctl status nginx
    exit 1
fi

# Тестируем прокси
echo "🧪 Тестируем прокси..."
TEST_RESULT=$(curl -s -u "$PROXY_USER:$PROXY_PASS" -w "%{http_code}" -o /dev/null --max-time 10 "http://localhost:8888/httpbin.org/ip" 2>/dev/null)

if [ "$TEST_RESULT" = "200" ]; then
    echo "✅ Прокси работает корректно"
else
    echo "⚠️ Прокси запущен, но тест показал код: $TEST_RESULT"
    echo "   Это нормально, если httpbin.org недоступен"
fi

echo ""
echo "🎉 Развертывание завершено!"
echo "=============================================="
echo "🌐 Адрес прокси: http://$SERVER_IP:8888"
echo "👤 Пользователь: $PROXY_USER"
echo "🔑 Пароль: $PROXY_PASS"
echo ""
echo "📝 Настройки для вашего бота (.env):"
echo "PROXY_ENABLED=true"
echo "PROXY_SERVER=http://$SERVER_IP:8888"
echo "PROXY_USERNAME=$PROXY_USER"
echo "PROXY_PASSWORD=$PROXY_PASS"
echo ""
echo "🔧 Управление:"
echo "   Статус:     sudo systemctl status nginx"
echo "   Перезапуск: sudo systemctl restart nginx"
echo "   Остановка:  sudo systemctl stop nginx"
echo "   Логи:       sudo tail -f /var/log/nginx/access.log"
echo ""
echo "🧪 Тест прокси:"
echo "curl -u $PROXY_USER:$PROXY_PASS http://$SERVER_IP:8888/httpbin.org/ip"