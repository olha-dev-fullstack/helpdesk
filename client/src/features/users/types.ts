export type UserRole = "admin" | "agent";

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
};

export type UserFormValues = {
  name: string;
  email: string;
  password: string;
};
