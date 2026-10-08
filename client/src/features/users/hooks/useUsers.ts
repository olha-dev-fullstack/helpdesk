import { useQuery } from "@tanstack/react-query";
import { fetchUsers } from "../api";
import { USERS_QUERY_KEY } from "../constants";

export function useUsers() {
  return useQuery({ queryKey: [USERS_QUERY_KEY], queryFn: fetchUsers });
}
