/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_AMAP_KEY?: string;
  readonly VITE_AMAP_SECURITY_JS_CODE?: string;
  readonly VITE_EXECUTION_SERVICE_URL?: string;
  readonly VITE_MQTT_GATEWAY_URL?: string;
  readonly VITE_USE_HASH_ROUTER?: string;
  readonly VITE_WIFI_DEMO_MQTT_USER_ID?: string;
  readonly VITE_WIFI_DEMO_DEVICE_ID?: string;
  readonly VITE_WIFI_DEMO_DEVICE_NAME?: string;
  readonly VITE_WIFI_DEMO_DEVICE_MODEL?: string;
  readonly VITE_WIFI_DEMO_FIELD_NAME?: string;
  readonly VITE_WIFI_DEMO_STATIONS?: string;
  readonly VITE_WIFI_DEMO_TOPIC_PREFIX?: string;
  readonly VITE_WIFI_DEMO_TOPIC_DEVICE_INFO?: string;
  readonly VITE_WIFI_DEMO_TOPIC_DEVICE_INFO_REPLY?: string;
  readonly VITE_WIFI_DEMO_TOPIC_DEVICE_CONTROL?: string;
  readonly VITE_WIFI_DEMO_TOPIC_DEVICE_CONTROL_REPLY?: string;
  readonly VITE_WIFI_DEMO_TOPIC_DEVICE_INFO_UPDATE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
