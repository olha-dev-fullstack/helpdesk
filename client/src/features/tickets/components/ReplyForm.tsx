import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useReplyForm } from "../hooks/useReplyForm";

export function ReplyForm({ ticketId }: { ticketId: string }) {
  const { form, onSubmit, onPolish, isPolishing } = useReplyForm(ticketId);
  const {
    register,
    watch,
    formState: { errors, isSubmitting },
  } = form;
  const isEmpty = !watch("body").trim();

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      <Field data-invalid={!!errors.body}>
        <FieldLabel htmlFor="reply-body">Reply</FieldLabel>
        <Textarea
          id="reply-body"
          rows={5}
          placeholder="Write a reply..."
          aria-invalid={!!errors.body}
          {...register("body")}
        />
        <FieldError errors={[errors.body]} />
      </Field>
      <FieldError errors={[errors.root]} />
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onPolish} disabled={isEmpty || isPolishing || isSubmitting}>
          {isPolishing ? "Polishing..." : "Polish"}
        </Button>
        <Button type="submit" disabled={isEmpty || isSubmitting || isPolishing}>
          {isSubmitting ? "Sending..." : "Send reply"}
        </Button>
      </div>
    </form>
  );
}
