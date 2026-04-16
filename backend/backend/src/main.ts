import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS — FRONTEND_URL may be comma-separated (e.g. local + production + staging).
  // Set CORS_ALLOW_VERCEL_PREVIEW=false to block *.vercel.app preview deployments.
  const allowList = (process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allowVercel =
    process.env.CORS_ALLOW_VERCEL_PREVIEW !== 'false';

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) {
        return callback(null, true);
      }
      if (allowList.includes(origin)) {
        return callback(null, true);
      }
      if (
        allowVercel &&
        /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  });

  // API prefix
  app.setGlobalPrefix('api/v1');

  // Swagger docs
  const config = new DocumentBuilder()
    .setTitle('AdharaEdu API')
    .setDescription('AdharaEdu — Tech Skills for Schools Platform API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3002;
  await app.listen(port);
  console.log(`\n🚀 AdharaEdu API running on: http://localhost:${port}/api/v1`);
  console.log(`📚 Swagger docs at: http://localhost:${port}/api/docs\n`);
}

bootstrap();
