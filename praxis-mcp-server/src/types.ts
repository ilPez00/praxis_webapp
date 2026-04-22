export interface User {
  id: string;
  email?: string;
  name: string;
  age?: number;
  bio?: string;
  points?: number;
  streak?: number;
}

export interface AuthSession {
  accessToken: string;
  refreshToken?: string;
  user: {
    id: string;
    email?: string;
  };
}
