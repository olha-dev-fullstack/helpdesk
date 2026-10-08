import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useReplyForm } from "../hooks/useReplyForm";

export function ReplyForm({ ticketId }: { ticketId: string }) {
  const { form, onSubmit } = useReplyForm(ticketId);
  const {
    register,
    formState: { errors, isSubmitting },
  } = form;

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
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Sending..." : "Send reply"}
      </Button>
    </form>
  );
}
