import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { authClient, useSession } from "@/lib/auth-client";

export default function NavBar() {
  const navigate = useNavigate();
  const { data: session } = useSession();

  async function handleSignOut() {
    await authClient.signOut();
    navigate("/login");
  }

  return (
    <nav className="flex items-center justify-between border-b px-6 py-3">
      <span className="text-lg font-semibold">Helpdesk</span>
      {session && (
        <div className="flex items-center gap-3">
          <span className="hidden text-sm font-medium sm:inline">
            {session.user.name}
          </span>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
      )}
    </nav>
  );
}
