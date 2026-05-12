import { createApp } from './app.mjs';
import { createAssistantService } from './assistant-service.mjs';
import { createMiniAuthService } from '../../shared/mini-auth-service.mjs';
import { loadConfig } from './config.mjs';

const config = loadConfig();
const authService = createMiniAuthService(config);
const assistantService = createAssistantService(config);
const app = createApp({ ...config, authService, assistantService });

app.listen(config.port, config.host, () => {
  console.log(`[assistant-service] listening on ${config.host}:${config.port}`);
  console.log('[assistant-service] config', {
    supabaseUrl: config.supabaseUrl,
    difyBaseUrl: config.difyBaseUrl,
  });
});
