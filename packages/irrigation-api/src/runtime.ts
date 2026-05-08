export interface MiniMeResponse {
  user: {
    id: string;
    name: string;
    role?: string;
  };
  project?: {
    id: string;
    name: string;
  };
}

export interface MiniRuntimeResponse {
  version: string;
  apiBaseUrl: string;
  dataSource: 'mock' | 'node' | 'supabase';
}
