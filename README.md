# Тестове завдання

API на `NestJS` для роботи з ролями `admin` і `client`, символами та Socket.IO-підписками на оновлення цін.

## Що реалізовано

- автентифікація через `POST /login`, `POST /refresh`, `POST /logout`
- роль `admin`
- роль `client`
- керування символами
- клієнтський модуль:
  - `GET /me`
  - `GET /symbols`
- admin-модуль:
  - `POST /create`
  - `PUT /disable-socket`
  - `DELETE /remove`
- `Socket.IO` gateway для client:
  - підключення тільки для користувача з роллю `client`
  - підписка на доступні символи
  - відписка від символів
  - отримання оновлень ціни
- `BinanceProvider` модуль:
  - одне websocket-підключення до Binance Spot Streams
  - автоматична підписка на symbols із БД при старті
  - автоматична підписка при створенні нового symbol
  - оновлення ціни з Binance та пересилання в client socket

## Технології

- `NestJS`
- `MongoDB`
- `Mongoose`
- `JWT`
- `Socket.IO`
- `Swagger`
- `Docker Compose`

## Запуск через Docker

### 1. Створити файл `.env`

У корені проєкту потрібно створити файл `.env`.

Приклад:

```env
PORT=3000
NODE_ENV=development

MONGO_URI=mongodb://mongodb:27017/forbus-test

JWT_ACCESS_SECRET=super-secret-access-key
JWT_REFRESH_SECRET=super-secret-refresh-key
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d

BCRYPT_SALT_ROUNDS=10

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin12345
```

Примітки:

- для запуску через `docker compose` у `MONGO_URI` потрібно використовувати хост `mongodb`, бо це ім'я сервісу в [docker-compose.yml](/Users/mac/dev/forbus-test/docker-compose.yml)
- при старті застосунку автоматично створюється default admin з `ADMIN_EMAIL` та `ADMIN_PASSWORD`, якщо такого користувача ще немає в базі

### 2. Запустити сервіси

```bash
docker compose up --build
```

Після запуску буде доступно:

- API: `http://localhost:3000`
- Swagger: `http://localhost:3000/api/docs`
- MongoDB: `mongodb://localhost:27017`

### 3. Зупинити сервіси

```bash
docker compose down
```

Якщо потрібно також видалити volume з даними MongoDB:

```bash
docker compose down -v
```

## Локальний запуск без Docker

### 1. Встановити залежності

```bash
npm install
```

### 2. Підняти MongoDB

Потрібен запущений `MongoDB`, після чого в `.env` слід вказати локальний URI, наприклад:

```env
MONGO_URI=mongodb://localhost:27017/forbus-test
```

### 3. Запустити застосунок

```bash
npm run start:dev
```

## Swagger

Swagger доступний за адресою:

```text
http://localhost:3000/api/docs
```

У Swagger описані HTTP-маршрути:

- `auth`
- `symbols`
- `client`
- `admin`

## BinanceProvider

Модуль `BinanceProvider` потрібен для того, щоб бекенд сам отримував актуальні ціни з Binance і не вимагав ручного оновлення через `PATCH /symbols/:id`.

Простими словами:

- у symbol є поле `providerSymbol`, наприклад `BTCUSDT`
- це означає, що ціна для цього symbol має приходити з Binance
- бекенд підписується на Binance WebSocket stream для цього `providerSymbol`
- коли Binance надсилає новий тік, бекенд оновлює ціну в БД
- після цього ціна автоматично відправляється в socket для client, які підписані на цей symbol

Як це працює:

- при старті застосунку модуль відкриває одне websocket-з'єднання з Binance
- далі з БД вичитуються всі існуючі symbols
- для кожного symbol береться `providerSymbol`
- модуль підписується на Binance stream `<providerSymbol>@miniTicker`
- якщо admin створює новий symbol, модуль одразу підписується на нього
- якщо admin змінює `providerSymbol`, модуль синхронізує підписку
- якщо admin видаляє symbol, модуль відписується від нього

Шлях даних такий:

`Binance -> BinanceProvider -> оновлення price в БД -> SymbolUpdatesService -> ClientGateway -> client socket`

Тобто головна користь цього модуля в тому, що:

- ціни приходять автоматично
- при рестарті сервера підписки відновлюються з БД
- client отримує live price updates без ручного втручання

Важливо:

- для роботи цього модуля застосунок повинен мати вихід в інтернет до `wss://stream.binance.com:9443`
- використовується stream типу `miniTicker`
- `providerSymbol` нормалізується у верхній регістр, наприклад `BTCUSDT`

## Socket.IO для client

### Namespace

Client gateway працює на namespace:

```text
/client
```

Повна адреса для підключення:

```text
ws://localhost:3000/client
```

### Авторизація

Підключення по сокету дозволене тільки для користувача з роллю `client`.

Під час socket-handshake перевіряється:

- наявність `accessToken`
- валідність `JWT`
- роль користувача `client`
- що для client не встановлено `socketDisabled = true`

Токен можна передати:

- через header `Authorization: Bearer <accessToken>`
- або через cookie `accessToken=<accessToken>`

### Події клієнта

Client може відправляти такі події:

#### `symbols.subscribe`

Payload:

```json
{
  "symbolIds": ["<symbol_id_1>", "<symbol_id_2>"]
}
```

Результат:

- підписка тільки на доступні public symbols
- у відповідь приходить подія `symbols.subscribed`

#### `symbols.unsubscribe`

Payload:

```json
{
  "symbolIds": ["<symbol_id_1>", "<symbol_id_2>"]
}
```

Результат:

- client відписується від указаних символів
- у відповідь приходить подія `symbols.unsubscribed`

### Події від сервера

#### `symbols.subscribed`

Приклад:

```json
{
  "subscribed": [
    {
      "id": "660bf3706c8f8720da6f01b4",
      "name": "Bitcoin",
      "public": true,
      "price": 62000,
      "providerSymbol": "BTCUSDT"
    }
  ],
  "rejectedSymbolIds": []
}
```

#### `symbols.unsubscribed`

Приклад:

```json
{
  "unsubscribedSymbolIds": ["660bf3706c8f8720da6f01b4"]
}
```

#### `symbols.price.updated`

Приклад:

```json
{
  "id": "660bf3706c8f8720da6f01b4",
  "name": "Bitcoin",
  "public": true,
  "price": 62500,
  "providerSymbol": "BTCUSDT"
}
```

Ця подія надсилається всім client-сокетам, які підписані на конкретний symbol, коли admin оновлює ціну через `PATCH /symbols/:id`.

#### `socket.disabled`

Приклад:

```json
{
  "message": "Socket access disabled by admin"
}
```

Після цієї події з'єднання буде примусово закрите.

## Як перевірити socket у Postman

### 1. Залогінитися під client

Спочатку виконай `POST /login` і отримай `accessToken`.

### 2. Створити Socket.IO request

У Postman:

1. `New -> Socket.IO`
2. URL:

```text
ws://localhost:3000/client
```

3. Додати header:

```text
Authorization: Bearer <accessToken>
```

4. Натиснути `Connect`

### 3. Додати listeners

У вкладці `Events` додати:

- `symbols.subscribed`
- `symbols.unsubscribed`
- `symbols.price.updated`
- `socket.disabled`

### 4. Підписатися на symbol

Event name:

```text
symbols.subscribe
```

Payload:

```json
{
  "symbolIds": ["<symbol_id>"]
}
```

### 5. Перевірити оновлення ціни

Поки socket підключений і підписаний, онови symbol під admin:

```bash
curl -b admin.cookies.txt \
  -X PATCH http://localhost:3000/symbols/<symbol_id> \
  -H 'Content-Type: application/json' \
  -d '{"price":62500}'
```

У Postman має прийти подія:

```text
symbols.price.updated
```

### 6. Відписатися

Event name:

```text
symbols.unsubscribe
```

Payload:

```json
{
  "symbolIds": ["<symbol_id>"]
}
```
