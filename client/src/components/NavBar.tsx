import { Link, NavLink, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { authClient, useSession } from "@/lib/auth-client";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm font-medium transition-colors hover:text-foreground ${
    isActive ? "text-foreground" : "text-muted-foreground"
  }`;

export default function NavBar() {
  const navigate = useNavigate();
  const { data: session } = useSession();

  async function handleSignOut() {
    await authClient.signOut({
      fetchOptions: { onSuccess: () => navigate("/login", { replace: true }) },
    });
  }

  return (
    <nav className="flex items-center justify-between border-b px-6 py-3">
      <div className="flex items-center gap-6">
        <Link to="/" className="text-lg font-semibold">
          Helpdesk
        </Link>
        <NavLink to="/tickets" className={navLinkClass}>
          Tickets
        </NavLink>
        {session?.user.role === "admin" && (
          <NavLink
            to="/users"
            className={navLinkClass}
          >
            Users
          </NavLink>
        )}
      </div>
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
