import { useSession } from "../lib/auth-client";

export default function HomePage() {
  const { data: session } = useSession();

  return <h1>Welcome, {session?.user.name}</h1>;
}
