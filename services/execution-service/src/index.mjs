import { createApp } from './app.mjs';
import { createAuthService } from './auth-service.mjs';
import { loadConfig } from './config.mjs';
import { createMiniService } from './mini-service.mjs';
import { createRunService } from './run-service.mjs';

const config = loadConfig();
const authService = createAuthService(config);
const runService = createRunService(config);
const miniService = createMiniService(config);
const app = createApp({ ...config, authService, runService, miniService });

runService.startScheduler();

process.on('SIGINT', () => {
  runService.stopScheduler();
  process.exit(0);
});

process.on('SIGTERM', () => {
  runService.stopScheduler();
  process.exit(0);
});

app.listen(config.port, config.host, () => {
  console.log(`[execution-service] listening on ${config.host}:${config.port}`);
});
