# Sūtra Setup

## 1) Install dependencies

```bash
npm install
```

## 2) Configure environment

```bash
cp .env.example .env
# edit .env with your PostgreSQL credentials
```

## 3) Generate Prisma client and run migrations

```bash
npx prisma generate
npm run db:migrate
```

## 4) Seed database

```bash
npm run db:seed
```

## 5) Run the API

```bash
npm run dev
```

GraphQL endpoint: `http://localhost:4000/graphql`

## 6) Build and run in production mode

```bash
npm run build
npm run start
```

## 7) Run tests

```bash
npm run test
```
