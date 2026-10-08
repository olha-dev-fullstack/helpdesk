import axios from "axios";
import type { User, UserFormValues } from "./types";

export async function fetchUsers(): Promise<User[]> {
  const { data } = await axios.get<{ users: User[] }>("/api/users");
  return data.users;
}

/** Updates `userId` when given, otherwise creates a new user. */
export function saveUser(values: UserFormValues, userId?: string) {
  return userId
    ? axios.patch(`/api/users/${userId}`, values)
    : axios.post("/api/users", values);
}

export function deleteUser(userId: string) {
  return axios.delete(`/api/users/${userId}`);
}
