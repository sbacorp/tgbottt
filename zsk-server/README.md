# ZSK Прокси Сервер

Простой HTTP/HTTPS прокси на nginx для ZSK бота. Развертывание за 2 минуты.

## 🚀 Установка на сервере

```bash
# 1. Скопируйте папку zsk-server на ваш сервер
scp -r zsk-server/ user@your-server.com:/home/user/

# 2. Подключитесь к серверу и запустите установку
ssh user@your-server.com
cd zsk-server
sudo ./quick-deploy.sh
```

**Готово!** Скрипт выведет настройки для вашего бота.

## 📝 Настройка бота

Скопируйте настройки в `.env` файл бота:

```env
PROXY_ENABLED=true
PROXY_SERVER=http://YOUR_SERVER_IP:8888
PROXY_USERNAME=proxy_user
PROXY_PASSWORD=generated_password
```

## 🔧 Управление

```bash
# Статус
sudo systemctl status nginx

# Перезапуск
sudo systemctl restart nginx

# Логи
sudo tail -f /var/log/nginx/access.log
```

## 🧪 Тест

```bash
curl -u username:password http://your-server:8888/httpbin.org/ip
```

## 📁 Файлы

- `nginx.conf` - Конфигурация прокси
- `quick-deploy.sh` - Скрипт автоматической установки
- `README.md` - Эта инструкция