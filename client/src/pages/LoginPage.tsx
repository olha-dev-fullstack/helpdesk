import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router";
import { authClient, useSession } from "../lib/auth-client";

export default function LoginPage() {
  const navigate = useNavigate();
  const { data: session, isPending } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isPending && session) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const { error } = await authClient.signIn.email({ email, password });
    setSubmitting(false);
    if (error) {
      setError(error.message ?? "Sign in failed");
      return;
    }
    navigate("/");
  }

  return (
    <div className="login-page">
      <form className="ticket" onSubmit={handleSubmit}>
        <header className="ticket-head">
          <span className="wordmark">Helpdesk</span>
          <h1>Sign in</h1>
          <p>Use the account your admin set up for you.</p>
        </header>
        <div className="ticket-tear" aria-hidden="true" />
        <div className="ticket-body">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              autoFocus
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="btn-primary" type="submit" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </div>
      </form>
    </div>
  );
}
