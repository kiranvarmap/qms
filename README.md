# QMS - Quality Management System

Internal quality management and product management tool built on the Vercel stack.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: Vercel Postgres (Neon)
- **ORM**: Drizzle ORM
- **Auth**: NextAuth.js v5 (Auth.js)
- **Email**: Resend (magic links)
- **UI**: Tailwind CSS + custom components
- **Deployment**: Vercel

## Getting Started

### 1. Install

```bash
npm install
```

### 2. Set Up Vercel Postgres

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Create a new **Postgres** database (or link an existing one)
3. Pull the environment variables:

```bash
npx vercel env pull .env.local
```

Or manually copy `.env.example` to `.env.local` and fill in the values.

### 3. Set Up Auth

Generate an auth secret:

```bash
openssl rand -base64 32
```

Add it to `.env.local` as `AUTH_SECRET`.

### 4. Set Up Resend (for magic link emails)

1. Sign up at [resend.com](https://resend.com)
2. Get your API key
3. Add it to `.env.local` as `AUTH_RESEND_KEY`

### 5. Push Database Schema

```bash
npm run db:push
```

### 6. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**The first user to sign up is automatically made an Admin.**

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run db:push` | Push schema to database |
| `npm run db:generate` | Generate migration files |
| `npm run db:migrate` | Run migrations |
| `npm run db:studio` | Open Drizzle Studio |

## Features

### Authentication
- Email + Password sign-in
- Magic link (passwordless) sign-in via Resend
- Session management with JWT

### User Management (Admin)
- View all users with status, role, and join date
- Approve / reject pending users
- Activate / deactivate users
- Change user roles (Admin, Manager, User)
- Invite users via email
- Delete users

### Profile Management
- View account information
- Update display name
- Change password

### Security
- Role-based access control (Admin, Manager, User)
- Middleware-level route protection
- Admin-only API routes
- Password hashing with bcrypt (12 rounds)
- Self-demotion prevention

## Deployment to Vercel

1. Push to GitHub
2. Import in Vercel
3. Add a Vercel Postgres database
4. Set environment variables (`AUTH_SECRET`, `AUTH_RESEND_KEY`, `EMAIL_FROM`)
5. Deploy
