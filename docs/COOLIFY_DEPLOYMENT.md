# Friday Quiz - Coolify Deployment Guide

## Prerequisites

- Coolify instance running
- PostgreSQL database (Coolify managed)
- Git repository connected to Coolify

## Environment Variables

Set the following environment variables in Coolify:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db?schema=public` |
| `NEXTAUTH_SECRET` | Random secret for NextAuth | Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Your deployed app URL | `https://fridayquiz.yourdomain.com` |
| `QUIZMASTER_EMAIL` | Admin email address | `admin@yourdomain.com` |
| `SMTP_HOST` | Brevo SMTP server | `smtp-relay.brevo.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP login | `abd95a001@smtp-brevo.com` |
| `SMTP_PASS` | SMTP password | `xsmtpsib-...` |
| `EMAIL_FROM` | From email address | `noreply@daveys.xyz` |

## Database Setup

1. Create a PostgreSQL database in Coolify
2. Copy the connection string
3. Set it as `DATABASE_URL` in your environment variables
4. Run database migrations:

```bash
npx prisma db push
# or
npx prisma migrate dev
```

## Build Source

**Important:** In Coolify, set **Build Source** to `Dockerfile` (not `nixpacks`).

1. Go to your application in Coolify
2. Scroll to **Build System**
3. Change **Build Source** from `nixpacks` to `dockerfile`
4. Save and redeploy

This ensures the multi-stage Dockerfile is used, which properly installs dependencies before building.

## Git Repository

Push to your repository connected to Coolify:

```bash
git add .
git commit -m "Initial setup"
git push origin main
```

## Post-Deployment

1. Verify the app is running at your deployed URL
2. The first user to sign in becomes admin (QUIZMASTER role)
3. Or if `QUIZMASTER_EMAIL` is set, that email gets QUIZMASTER role

## Domain Setup

1. In Coolify, add your custom domain
2. Configure DNS records as instructed
3. SSL certificates are auto-provided

## Troubleshooting

- **Database connection issues**: Verify `DATABASE_URL` is correct
- **Email not sending**: Check SMTP credentials and `EMAIL_FROM`
- **Auth not working**: Verify `NEXTAUTH_SECRET` and `NEXTAUTH_URL` match
- **Build failures**: Check Node.js version (18+ required)