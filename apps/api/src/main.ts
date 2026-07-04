import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { ValidationPipe } from '@nestjs/common';
import { json, static as serveStatic, urlencoded } from 'express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(json({ limit: '12mb' }));
  app.use(urlencoded({ extended: true, limit: '12mb' }));
  app.use(
    '/uploads/community',
    serveStatic(
      process.env.COMMUNITY_UPLOAD_DIR ?? join(process.cwd(), 'uploads', 'community'),
      { fallthrough: false, index: false },
    ),
  );
  app.use(cookieParser());
  app.use(compression());
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
