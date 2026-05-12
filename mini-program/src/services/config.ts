declare const __MINI_PROGRAM_PROFILE__: 'local' | 'test';
declare const __MINI_USE_MOCK_DATA__: boolean;
declare const __MINI_EXECUTION_SERVICE_URL__: string;
declare const __MINI_ASSISTANT_SERVICE_URL__: string;
declare const __MINI_MQTT_GATEWAY_URL__: string;
declare const __MINI_AI_ASSISTANT_URL__: string;
declare const __MINI_AUTH_EMAIL__: string;
declare const __MINI_AUTH_PASSWORD__: string;

export interface MiniProgramRuntimeConfig {
  profile: 'local' | 'test';
  useMockData: boolean;
  executionServiceUrl: string;
  assistantServiceUrl: string;
  mqttGatewayUrl: string;
  aiAssistantUrl: string;
  authEmail: string;
  authPassword: string;
}

function readStringConstant(value: string | undefined, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

export const runtimeConfig: MiniProgramRuntimeConfig = {
  profile: typeof __MINI_PROGRAM_PROFILE__ !== 'undefined' ? __MINI_PROGRAM_PROFILE__ : 'local',
  useMockData: typeof __MINI_USE_MOCK_DATA__ !== 'undefined' ? __MINI_USE_MOCK_DATA__ : false,
  executionServiceUrl:
    typeof __MINI_EXECUTION_SERVICE_URL__ !== 'undefined' ? __MINI_EXECUTION_SERVICE_URL__ : '',
  assistantServiceUrl:
    typeof __MINI_ASSISTANT_SERVICE_URL__ !== 'undefined' ? __MINI_ASSISTANT_SERVICE_URL__ : '',
  mqttGatewayUrl:
    typeof __MINI_MQTT_GATEWAY_URL__ !== 'undefined' ? __MINI_MQTT_GATEWAY_URL__ : '',
  aiAssistantUrl:
    typeof __MINI_AI_ASSISTANT_URL__ !== 'undefined'
      ? readStringConstant(__MINI_AI_ASSISTANT_URL__)
      : '',
  authEmail: typeof __MINI_AUTH_EMAIL__ !== 'undefined' ? readStringConstant(__MINI_AUTH_EMAIL__) : '',
  authPassword:
    typeof __MINI_AUTH_PASSWORD__ !== 'undefined' ? readStringConstant(__MINI_AUTH_PASSWORD__) : '',
};
