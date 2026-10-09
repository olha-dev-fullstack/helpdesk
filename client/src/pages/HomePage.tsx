import { DashboardStats } from "@/features/dashboard/components/DashboardStats";
import { useSession } from "@/lib/auth-client";

export default function HomePage() {
  const { data: session } = useSession();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Welcome, {session?.user.name}</h1>
      <DashboardStats />
    </div>
  );
}
