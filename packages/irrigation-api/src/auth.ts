export interface MiniLoginInput {
  email: string;
  password: string;
}

export interface MiniSessionUser {
  id: string;
  email: string;
  name: string;
  role?: string;
}

export interface MiniLoginResponse {
  accessToken: string;
  expiresAt: string;
  user: MiniSessionUser;
  project?: {
    id: string;
    name: string;
  };
}

export interface MiniLogoutResponse {
  success: boolean;
}
