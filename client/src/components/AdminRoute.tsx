import { Navigate, Outlet } from "react-router";
import { useSession } from "@/lib/auth-client";

export default function AdminRoute() {
  const { data: session } = useSession();

  if (session?.user.role !== "admin") return <Navigate to="/" replace />;

  return <Outlet />;
}
