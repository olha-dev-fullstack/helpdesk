import { Navigate, Outlet } from "react-router";
import { useSession } from "../lib/auth-client";
import NavBar from "./NavBar";

export default function ProtectedRoute() {
  const { data: session, isPending } = useSession();

  if (isPending) return <p>Loading...</p>;
  if (!session) return <Navigate to="/login" replace />;

  return (
    <>
      <NavBar />
      <main>
        <Outlet />
      </main>
    </>
  );
}
