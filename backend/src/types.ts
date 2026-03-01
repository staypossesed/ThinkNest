export interface AppSession {
  token: string;
  user: {
    id: string;
    email: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
}
