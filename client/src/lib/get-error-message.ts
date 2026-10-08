import axios from "axios";

/** The server's `{ error }` message for a failed request, or `fallback`. */
export function getErrorMessage(err: unknown, fallback: string): string {
  return axios.isAxiosError(err) && err.response?.data?.error
    ? String(err.response.data.error)
    : fallback;
}
