import { useSession } from "@/lib/auth-client";

export default function HomePage() {
  const { data: session } = useSession();

  return <h1 className="text-3xl font-semibold">Welcome, {session?.user.name}</h1>;
}
