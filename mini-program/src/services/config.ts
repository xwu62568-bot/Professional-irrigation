declare const __MINI_PROGRAM_PROFILE__: 'local' | 'test';
declare const __MINI_USE_MOCK_DATA__: boolean;
declare const __MINI_EXECUTION_SERVICE_URL__: string;
declare const __MINI_MQTT_GATEWAY_URL__: string;
declare const __MINI_AUTH_EMAIL__: string;
declare const __MINI_AUTH_PASSWORD__: string;

export interface MiniProgramRuntimeConfig {
  profile: 'local' | 'test';
  useMockData: boolean;
  executionServiceUrl: string;
  mqttGatewayUrl: string;
  authEmail: string;
  authPassword: string;
}

export const runtimeConfig: MiniProgramRuntimeConfig = {
  profile: __MINI_PROGRAM_PROFILE__,
  useMockData: __MINI_USE_MOCK_DATA__,
  executionServiceUrl: __MINI_EXECUTION_SERVICE_URL__,
  mqttGatewayUrl: __MINI_MQTT_GATEWAY_URL__,
  authEmail: __MINI_AUTH_EMAIL__,
  authPassword: __MINI_AUTH_PASSWORD__,
};
