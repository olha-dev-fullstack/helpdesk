import { Navigate, Outlet } from "react-router";
import { useSession } from "@/lib/auth-client";
import NavBar from "./NavBar";

export default function ProtectedRoute() {
  const { data: session, isPending } = useSession();

  if (isPending) return <p>Loading...</p>;
  if (!session) return <Navigate to="/login" replace />;

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </>
  );
}
