import { SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTicketSummary } from "../hooks/useTicketSummary";

export function TicketSummary({ ticketId }: { ticketId: string }) {
  const { summary, isSummarizing, error, summarize } = useTicketSummary(ticketId);

  return (
    <div className="space-y-3">
      <Button type="button" variant="outline" onClick={summarize} disabled={isSummarizing}>
        <SparklesIcon />
        {isSummarizing ? "Summarizing..." : "Summarize"}
      </Button>
      {isSummarizing ? (
        <Skeleton className="h-16 w-full" />
      ) : error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : summary ? (
        <div className="rounded-md border bg-muted/50 p-3">
          <h2 className="mb-1 text-sm font-medium text-muted-foreground">Summary</h2>
          <p className="whitespace-pre-wrap break-words">{summary}</p>
        </div>
      ) : null}
    </div>
  );
}
