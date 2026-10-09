import { z } from "zod";

const MAX_EMAIL_LENGTH = 254;
const MAX_NAME_LENGTH = 200;
const MAX_SUBJECT_LENGTH = 300;
const MAX_BODY_LENGTH = 100_000;
const MAX_MESSAGE_ID_LENGTH = 998;

// Optional trimmed string: empty/null/missing become null
const optionalText = (max: number, name: string) =>
  z
    .string()
    .max(max, `${name} is too long`)
    .nullish()
    .transform((v) => v?.trim() || null);

export const inboundEmailSchema = z.object(
  {
    from: z
      .string()
      .trim()
      .toLowerCase()
      .max(MAX_EMAIL_LENGTH, "from must be a valid email address")
      .pipe(z.email("from must be a valid email address")),
    fromName: optionalText(MAX_NAME_LENGTH, "fromName"),
    subject: optionalText(MAX_SUBJECT_LENGTH, "subject"),
    text: z
      .string()
      .max(MAX_BODY_LENGTH, "text is too long")
      .trim()
      .min(1, "text must not be empty"),
    messageId: optionalText(MAX_MESSAGE_ID_LENGTH, "messageId"),
  },
  "from and text are required",
);

export type InboundEmail = z.infer<typeof inboundEmailSchema>;
