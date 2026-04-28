import { createApp } from './app.mjs';
import { loadConfig } from './config.mjs';
import { createMqttGateway } from './mqtt-manager.mjs';

const config = loadConfig();
const gateway = createMqttGateway(config);
const app = createApp({ ...config, gateway });

app.listen(config.port, config.host, () => {
  console.log(`[mqtt-gateway-service] listening on ${config.host}:${config.port}`);
});
