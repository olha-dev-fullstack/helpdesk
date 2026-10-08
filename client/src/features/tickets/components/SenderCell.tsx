export function SenderCell({ name, email }: { name: string | null; email: string }) {
  return (
    <>
      <div>{name ?? "Unknown"}</div>
      <div className="text-sm text-muted-foreground">{email}</div>
    </>
  );
}
