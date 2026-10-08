import { useQuery } from "@tanstack/react-query";
import { fetchAssignees } from "../api";
import { ASSIGNEES_QUERY_KEY } from "../constants";

export function useAssignees() {
  return useQuery({ queryKey: [ASSIGNEES_QUERY_KEY], queryFn: fetchAssignees });
}
