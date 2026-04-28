import { createApp } from './app.mjs';
import { loadConfig } from './config.mjs';
import { createRunService } from './run-service.mjs';

const config = loadConfig();
const runService = createRunService(config);
const app = createApp({ ...config, runService });

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
