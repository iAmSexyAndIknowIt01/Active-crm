import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': import.meta.dirname,
      // 'server-only' нь React Server орчноос гадна алдаа шиддэг; тестэд хоосон модуль болгоно
      'server-only': path.join(import.meta.dirname, 'tests/server-only-stub.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    // DB тестүүд нэг мэдээллийн сан дээр ажилладаг тул файлуудыг дараалан ажиллуулна
    fileParallelism: false,
    setupFiles: ['tests/vitest.setup.ts'],
  },
});
