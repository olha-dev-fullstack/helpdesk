import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { senderTypeLabel } from "../constants";
import { useReplies } from "../hooks/useReplies";
import { ReplyForm } from "./ReplyForm";

export function ReplyThread({ ticketId }: { ticketId: string }) {
  const { data: replies, isPending, isError } = useReplies(ticketId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Replies</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : isError ? (
          <p role="alert" className="text-destructive">
            Failed to load replies
          </p>
        ) : replies.length === 0 ? (
          <p className="text-muted-foreground">No replies yet.</p>
        ) : (
          <ul className="space-y-4">
            {replies.map((reply) => (
              <li key={reply.id} className="rounded-md border p-3">
                <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {reply.senderType === "customer"
                        ? "Customer"
                        : (reply.author?.name ?? "Deleted user")}
                    </span>
                    <Badge
                      variant={
                        reply.senderType === "agent" ? "secondary" : "outline"
                      }
                    >
                      {reply.senderType === "agent" &&
                      reply.author?.role === "admin"
                        ? "Admin"
                        : senderTypeLabel[reply.senderType]}
                    </Badge>
                  </span>
                  <time dateTime={reply.createdAt}>
                    {new Date(reply.createdAt).toLocaleString()}
                  </time>
                </div>
                <p className="whitespace-pre-wrap break-words">{reply.body}</p>
              </li>
            ))}
          </ul>
        )}
        <ReplyForm ticketId={ticketId} />
      </CardContent>
    </Card>
  );
}
