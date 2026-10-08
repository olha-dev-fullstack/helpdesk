import { Navigate, Outlet } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/auth-client";
import NavBar from "./NavBar";

export default function ProtectedRoute() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div aria-label="Loading page">
        <div className="flex items-center justify-between border-b px-6 py-3">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-8 w-28" />
        </div>
        <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-40 w-full" />
        </main>
      </div>
    );
  }
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
