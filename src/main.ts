import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module.js';
import { RedisIoAdapter } from './common/adapters/redis-io.adapter.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { doubleCsrfProtection } from './common/config/csrf.config.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bodyParser: true,
  });

  // Enable CORS with strict origin check
  const configService = app.get(ConfigService);
  const corsOrigin = configService.get<string>('CORS_ORIGIN');
  if (!corsOrigin && configService.get('NODE_ENV') === 'production') {
    throw new Error(
      'CORS_ORIGIN environment variable is required in production',
    );
  }

  const allowedOrigins = corsOrigin
    ? corsOrigin.split(',').map((o) => o.trim())
    : [
        'http://localhost:5173',
        'http://localhost:8080',
        'http://localhost:8081',
        'http://[::1]:5173',
      ];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // Security Headers (Strict CSP + defaults)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://fonts.googleapis.com',
          ],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: [
            "'self'",
            'data:',
            'https://res.cloudinary.com',
            ...allowedOrigins,
          ],
          mediaSrc: ["'self'", ...allowedOrigins, 'blob:'],
          connectSrc: ["'self'", ...allowedOrigins, 'wss://*'],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow frontend to access media
    }),
  );

  // Parse cookies (required for HTTP-only JWT cookie auth)
  app.use(cookieParser());

  // Global API Prefix
  app.setGlobalPrefix('api/v1');

  // CSRF Protection
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Normalize path: Remove double slashes and trailing slashes
    const normalizedPath =
      req.path.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
    const excludedPaths = [
      '/api/v1/auth/login',
      '/api/v1/auth/register',
      '/api/v1/auth/refresh',
      '/api/v1/auth/verify-email',
      '/api/v1/auth/request-reset',
      '/api/v1/auth/reset-password',
      '/api/v1/auth/passkey/login-options',
      '/api/v1/auth/passkey/login-verify',
      '/api/v1/csrf-token',
      '/api/v1/whitelist/signup',
    ];

    if (
      excludedPaths.includes(normalizedPath) ||
      normalizedPath.startsWith('/socket.io') ||
      normalizedPath.startsWith('/api/v1/socket.io')
    ) {
      next();
    } else {
      doubleCsrfProtection(req, res, next);
    }
  });

  // const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost)));

  // Use sensible global body parser limits (Dos protection)
  app.use(bodyParser.json({ limit: '500mb' }));
  app.use(bodyParser.urlencoded({ limit: '500mb', extended: true }));

  // WebSocket Redis Adapter
  const redisIoAdapter = new RedisIoAdapter(app, configService);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  // Enable validation

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('CircleSfera API')
    .setDescription(
      'Interactive API documentation for CircleSfera social platform',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get<number>('PORT') || 3000;

  // Final Security Check: Ensure critical secrets are set and strong
  if (configService.get('NODE_ENV') !== 'test') {
    const secrets = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'CSRF_SECRET'];
    for (const key of secrets) {
      const val = configService.get<string>(key);
      if (!val || val.length < 64) {
        throw new Error(
          `SECURITY ALERT: ${key} is missing or too weak (min 64 chars required).`,
        );
      }
    }
  }

  await app.listen(port);
  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
}

void bootstrap();
