import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { TICKETS_PATH } from "../constants";

export function BackToTicketsLink() {
  return (
    <Link
      to={TICKETS_PATH}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft aria-hidden className="size-4" />
      Back to tickets
    </Link>
  );
}
