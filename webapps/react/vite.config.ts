import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';

// The webapp serves this bundle under <app root>/app/react/. The app root
// (servlet context path + webapp application path, e.g. "/cadenzaflow") is
// only known at runtime, so index.html carries the $APP_ROOT placeholder and
// ProcessEnginesFilter fills it in when it serves the page.
const HTML_ASSET_BASE = '$APP_ROOT/app/react/';

// `npm run dev` proxies to a running CadenzaFlow (Run, Tomcat or a Spring Boot
// app). Override both values when your backend differs.
const DEV_BACKEND = process.env.CZ_BACKEND ?? 'http://localhost:8080';
const DEV_APP_ROOT = process.env.CZ_APP_ROOT ?? '/cadenzaflow';

/**
 * The webapp's Content-Security-Policy uses a per-request nonce with
 * 'strict-dynamic': only scripts carrying the nonce may run. The server
 * replaces $CSP_NONCE with nonce="..." (same placeholder as the AngularJS
 * index pages), so every script tag of the built index.html gets it.
 * In dev mode there is no CSP, so the placeholders are filled locally.
 */
function serverPlaceholders(): Plugin {
  return {
    name: 'cadenzaflow:server-placeholders',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (ctx.server) {
          return html.replaceAll('$APP_ROOT', DEV_APP_ROOT);
        }
        return html.replace(/<script(?=[\s>])/g, '<script $CSP_NONCE');
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), serverPlaceholders()],
  css: {
    // Carbon's Sass still uses syntax that newer Sass versions deprecate
    preprocessorOptions: { scss: { quietDeps: true } },
  },
  build: {
    outDir: 'target/webapp/app/react',
    emptyOutDir: true,
    // Preload <link>s would need the CSP nonce too; lazy chunks load fine
    // without them, so they are switched off instead.
    modulePreload: false,
  },
  experimental: {
    renderBuiltUrl(filename, { hostType }) {
      if (hostType === 'html') {
        return HTML_ASSET_BASE + filename;
      }
      // JS and CSS reference their chunks relative to themselves, so they
      // work under any app root.
      return { relative: true };
    },
  },
  server: {
    // Vite's CORS middleware would answer every OPTIONS request itself; the
    // engine REST API answers OPTIONS with the links the user may follow.
    cors: false,
    proxy: {
      // Everything except this app and Vite's own files goes to the backend:
      // the REST APIs, the AngularJS webapps and the forms of process
      // applications (embedded:app:).
      [`^(?!${DEV_APP_ROOT}/app/react/|/src/|/@|/node_modules/).*`]: { target: DEV_BACKEND, changeOrigin: false },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
