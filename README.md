# CircleSfera Backend API

A modern, production-ready REST API for a social media platform built with NestJS, PostgreSQL, and Prisma.

## 📋 Table of Contents

- [Overview](#overview)
- [Technology Stack](#technology-stack)
- [Features](#features)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Testing](#testing)
- [Security](#security)
- [Best Practices](#best-practices)
- [Backlog](#backlog)

## 🎯 Overview

CircleSfera Backend is a RESTful API that powers a social media application similar to Instagram. It provides comprehensive functionality for user authentication, content management, social interactions, and real-time notifications.

## 🛠 Technology Stack

| Category           | Technology        | Version |
| ------------------ | ----------------- | ------- |
| **Runtime**        | Node.js           | 20.x+   |
| **Framework**      | NestJS            | 11.1.10 |
| **Language**       | TypeScript        | 5.7.3   |
| **Database**       | PostgreSQL        | 15+     |
| **ORM**            | Prisma            | 7.3.0   |
| **Testing**        | Vitest            | 3.0.5   |
| **Authentication** | JWT (Passport)    | 0.7.0   |
| **Validation**     | class-validator   | 0.14.3  |
| **Security**       | bcrypt            | 6.0.0   |
| **Rate Limiting**  | @nestjs/throttler | 6.5.0   |

## ✨ Features

### Authentication & Authorization

- [x] User registration with email validation
- [x] Secure login with JWT tokens
- [x] Access token (15min) + Refresh token (7 days) strategy
- [x] Token refresh mechanism
- [x] Secure logout

### User Management

- [x] User profiles with customizable fields
- [x] Profile updates (bio, avatar, website)
- [x] Username uniqueness validation

### Content Management

- [x] Create, read, update, delete posts
- [x] Media URL support (images)
- [x] Caption support with optional text
- [x] 24-hour ephemeral stories

### Social Features

- [x] Follow/Unfollow users
- [x] Like/Unlike posts
- [x] Comments on posts
- [x] Personalized feed (followed users' posts)
- [x] Explore page (all posts)

### Notifications

- [x] Follow notifications
- [x] Like notifications
- [x] Comment notifications
- [x] Mark as read functionality
- [x] Unread count

## 📁 Project Structure

```
backend-api/
├── prisma/
│   ├── schema.prisma      # Database schema
│   ├── seed.ts            # Database seeding script
│   └── migrations/        # Database migrations
├── src/
│   ├── auth/              # Authentication module
│   │   ├── decorators/    # Custom decorators (@CurrentUser)
│   │   ├── dto/           # Data Transfer Objects
│   │   ├── guards/        # JWT Auth Guard
│   │   └── strategies/    # Passport JWT Strategy
│   ├── comments/          # Comments module
│   ├── common/            # Shared utilities
│   │   └── dto/           # Pagination DTOs
│   ├── follows/           # Follow system module
│   ├── likes/             # Likes module
│   ├── notifications/     # Notifications module
│   ├── posts/             # Posts module
│   ├── prisma/            # Prisma service
│   ├── profiles/          # User profiles module
│   ├── stories/           # Stories module
│   ├── users/             # Users module
│   ├── app.module.ts      # Root module
│   └── main.ts            # Application entry point
├── test/                  # E2E tests
├── vitest.config.ts       # Vitest configuration
├── vitest.e2e.config.ts   # E2E test configuration
├── .swcrc                 # SWC configuration for decorators
├── .env.example           # Environment variables template
└── package.json
```

## 🚀 Getting Started

### Prerequisites

- Node.js 20.x or higher
- PostgreSQL 15 or higher
- npm or yarn
- **Shared Package**: Must be built locally (see Root README)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd backend-api

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your database credentials
```

### Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/circlesfera?schema=public"

# JWT
JWT_SECRET="your-super-secret-jwt-key-min-32-chars"
JWT_REFRESH_SECRET="your-refresh-secret-key-min-32-chars"

# Server
PORT=3000
CORS_ORIGIN="http://localhost:5173"
```

### Database Setup

```bash
# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init

# Seed the database (optional)
npm run prisma:seed
```

### Running the Application

```bash
# Development
npm run start:dev

# Production build
npm run build
npm run start:prod
```

## 📚 API Documentation

### Base URL

```
http://localhost:3000/api/v1
```

### Authentication Endpoints

| Method | Endpoint         | Description          | Auth |
| ------ | ---------------- | -------------------- | ---- |
| POST   | `/auth/register` | Register new user    | No   |
| POST   | `/auth/login`    | Login user           | No   |
| POST   | `/auth/refresh`  | Refresh access token | No   |
| POST   | `/auth/logout`   | Logout user          | Yes  |

### Posts Endpoints

| Method | Endpoint         | Description           | Auth |
| ------ | ---------------- | --------------------- | ---- |
| GET    | `/posts/feed`    | Get personalized feed | Yes  |
| GET    | `/posts/explore` | Get all posts         | Yes  |
| GET    | `/posts/:id`     | Get single post       | Yes  |
| POST   | `/posts`         | Create new post       | Yes  |
| PUT    | `/posts/:id`     | Update post           | Yes  |
| DELETE | `/posts/:id`     | Delete post           | Yes  |

### Users & Profiles Endpoints

| Method | Endpoint              | Description              | Auth |
| ------ | --------------------- | ------------------------ | ---- |
| GET    | `/profiles/:username` | Get user profile         | Yes  |
| GET    | `/profiles/me`        | Get current user profile | Yes  |
| PUT    | `/profiles`           | Update profile           | Yes  |

### Social Endpoints

| Method | Endpoint                        | Description         | Auth |
| ------ | ------------------------------- | ------------------- | ---- |
| POST   | `/users/:username/follow`       | Toggle follow       | Yes  |
| GET    | `/users/:username/follow/check` | Check follow status | Yes  |
| POST   | `/posts/:id/like`               | Toggle like         | Yes  |
| GET    | `/posts/:id/like/check`         | Check like status   | Yes  |
| GET    | `/posts/:id/comments`           | Get post comments   | Yes  |
| POST   | `/posts/:id/comments`           | Add comment         | Yes  |

### Request/Response Examples

#### Register User

```json
POST /api/v1/auth/register
{
  "email": "user@example.com",
  "password": "securePassword123",
  "username": "johndoe",
  "fullName": "John Doe"
}

Response:
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

## 🗃 Database Schema

```
User
├── id (UUID)
├── email (unique)
├── password (hashed)
├── createdAt
├── updatedAt
└── Relations: Profile, Posts, Stories, Comments, Likes, Follows

Profile
├── id (UUID)
├── userId (unique)
├── username (unique)
├── fullName
├── bio
├── avatar
├── website
└── Relations: User

Post
├── id (UUID)
├── userId
├── caption
├── mediaUrl
├── mediaType
├── createdAt
└── Relations: User, Comments, Likes

Story
├── id (UUID)
├── userId
├── mediaUrl
├── mediaType
├── expiresAt
├── createdAt
└── Relations: User
```

## 🧪 Testing

This project uses **Vitest** for testing, providing:

- ⚡ Fast execution with native ESM support
- 🔧 Native TypeScript support via SWC
- 📊 Built-in code coverage
- 🎯 Jest-compatible API

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov

# Run E2E tests
npm run test:e2e
```

### Test Configuration

- **Unit tests**: `vitest.config.ts`
- **E2E tests**: `vitest.e2e.config.ts`
- **SWC config**: `.swcrc` (for decorator metadata support)

## 🔒 Security

### Implemented Security Measures

1. **Password Hashing**: bcrypt with salt rounds of 10
2. **JWT Tokens**: Short-lived access tokens (15min) + long-lived refresh tokens (7 days)
3. **Rate Limiting**: Three-tier throttling
   - Short: 10 requests/second
   - Medium: 100 requests/minute
   - Long: 1000 requests/hour
4. **Input Validation**: class-validator with whitelist mode
5. **CORS**: Configurable origin restriction
6. **SQL Injection Prevention**: Prisma ORM with parameterized queries

## 📐 Best Practices

### Code Organization

- **Modular Architecture**: Each feature in its own NestJS module
- **Separation of Concerns**: Controllers → Services → Prisma
- **DTOs**: Type-safe data transfer objects with validation
- **Custom Decorators**: Reusable @CurrentUser decorator

### TypeScript

- **Strict Mode**: Enabled for maximum type safety
- **Type-only Imports**: Using `import type` for type definitions
- **No Any Types**: Explicit typing throughout the codebase

### API Design

- **RESTful Conventions**: Proper HTTP methods and status codes
- **Pagination**: Consistent pagination with meta information
- **Error Handling**: Global exception filter with standardized responses
- **Versioning**: API versioned with `/api/v1` prefix

### Database

- **Prisma Migrations**: Version-controlled schema changes
- **Seeding**: Reproducible test data
- **Indexes**: Optimized for common queries
- **Relationships**: Proper foreign keys and constraints

## 📋 Backlog

### Completed ✅

- [x] Core authentication system
- [x] User profiles
- [x] Posts CRUD
- [x] Stories with 24h expiration
- [x] Follow/Unfollow system
- [x] Like system
- [x] Comment system
- [x] Notifications
- [x] Pagination
- [x] Rate limiting
- [x] Input validation
- [x] Vitest testing setup

### Future Enhancements 🚧

- [ ] Real-time notifications (WebSockets)
- [ ] Direct messaging
- [ ] Story reactions
- [ ] Post sharing
- [ ] Hashtag support
- [ ] User search
- [ ] Media upload to cloud storage (S3/Cloudinary)
- [ ] Email verification
- [ ] Password reset
- [ ] Two-factor authentication
- [ ] Admin dashboard
- [ ] Analytics

## 📄 License

MIT License - See LICENSE file for details.

## 👥 Contributors

- Development Team

---

Built with ❤️ using NestJS + Vitest
