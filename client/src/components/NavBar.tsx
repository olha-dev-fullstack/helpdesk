import { useNavigate } from "react-router";
import { authClient, useSession } from "../lib/auth-client";

export default function NavBar() {
  const navigate = useNavigate();
  const { data: session } = useSession();

  async function handleSignOut() {
    await authClient.signOut();
    navigate("/login");
  }

  return (
    <nav className="navbar">
      <span className="wordmark">Helpdesk</span>
      {session && (
        <div className="navbar-user">
          <span className="avatar" aria-hidden="true">
            {session.user.name.charAt(0).toUpperCase()}
          </span>
          <span className="navbar-name">{session.user.name}</span>
          <button className="btn-ghost" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      )}
    </nav>
  );
}
