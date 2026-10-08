import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  type TicketCategory,
  type TicketStatus,
} from "../src/generated/prisma/client";

const TICKET_COUNT = 100;
const SPREAD_DAYS = 45;

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type Template = { category: TicketCategory; subject: string; body: string };

const templates: Template[] = [
  // general_question
  { category: "general_question", subject: "What are your support hours?", body: "Hi, I couldn't find your support hours on the website. Are you available on weekends? Thanks!" },
  { category: "general_question", subject: "Do you offer a student discount?", body: "I'm a university student and would love to use your product. Is there a discounted plan for students?" },
  { category: "general_question", subject: "How do I change the email on my account?", body: "I recently switched jobs and need to move my account to my new work email. How can I do that without losing my data?" },
  { category: "general_question", subject: "Can I add more team members to my plan?", body: "We're growing and need three more seats. Is it possible to add them mid-cycle, and how is it billed?" },
  { category: "general_question", subject: "Where can I find my invoices?", body: "Our accounting team is asking for invoices for the last quarter. Where can I download them?" },
  { category: "general_question", subject: "Is there a mobile app?", body: "Does your service have an iOS or Android app? I mostly work from my phone." },
  { category: "general_question", subject: "Question about data retention", body: "How long do you keep our data after we cancel the subscription? We need this for a compliance review." },
  { category: "general_question", subject: "Do you support SSO with Okta?", body: "Our IT department requires single sign-on. Do you support SAML with Okta, and which plan includes it?" },
  { category: "general_question", subject: "Feature request: dark mode", body: "I use the dashboard late at night and the white background is rough on the eyes. Any plans for a dark theme?" },
  { category: "general_question", subject: "Upcoming maintenance window?", body: "I noticed some slowness yesterday evening. Was there maintenance, and is more planned this week?" },
  // technical_question
  { category: "technical_question", subject: "Can't log in after password reset", body: "I reset my password twice but the login page keeps saying 'invalid credentials'. I've tried Chrome and Safari." },
  { category: "technical_question", subject: "CSV export is missing columns", body: "When I export my report to CSV, the last three columns are empty. It worked fine last week." },
  { category: "technical_question", subject: "API returns 429 too many requests", body: "We started getting 429 errors from the API around noon even though we're well under the documented limit of 100 requests/min." },
  { category: "technical_question", subject: "Webhook events are delayed", body: "Our webhook endpoint is receiving events 10-15 minutes late since Tuesday. Nothing changed on our side." },
  { category: "technical_question", subject: "Two-factor codes not arriving", body: "I'm not getting the SMS code when I try to sign in. I've waited several minutes and requested it 4 times." },
  { category: "technical_question", subject: "Dashboard stuck on loading spinner", body: "After the latest update the dashboard just spins forever. Console shows a 500 from /api/reports." },
  { category: "technical_question", subject: "Integration with Slack stopped working", body: "Notifications to our #alerts channel stopped yesterday. Re-authorizing the app didn't help." },
  { category: "technical_question", subject: "Attachment upload fails over 5MB", body: "Uploading a PDF bigger than 5MB fails with 'network error'. The docs say the limit is 25MB." },
  { category: "technical_question", subject: "Wrong timezone on scheduled reports", body: "My weekly report arrives at 3 AM instead of 9 AM. My profile timezone is set to Europe/Berlin." },
  { category: "technical_question", subject: "Duplicate notifications on every comment", body: "Every time someone comments I get the email twice. It started after I enabled the browser extension." },
  { category: "technical_question", subject: "SSL certificate warning on custom domain", body: "Our custom domain support.example.org shows a certificate warning in Firefox since this morning." },
  // refund_request
  { category: "refund_request", subject: "Refund for accidental annual renewal", body: "My plan auto-renewed for a full year yesterday and I meant to cancel. Could you refund the charge? I haven't used the service since." },
  { category: "refund_request", subject: "Charged twice this month", body: "I see two identical charges on my card for this month's subscription. Please refund the duplicate." },
  { category: "refund_request", subject: "Requesting refund — service didn't meet needs", body: "We tried the Pro plan for two weeks and it lacks the integrations we need. Can we get a refund within the 30-day window?" },
  { category: "refund_request", subject: "Refund after downgrade", body: "I downgraded to the Basic plan but was still billed for Pro. I'd like the difference refunded." },
  { category: "refund_request", subject: "Cancel and refund unused seats", body: "We removed five seats last week but the invoice still includes them. Please adjust and refund the overcharge." },
  { category: "refund_request", subject: "Refund for outage last week", body: "Your service was down for most of Thursday, which hit our launch. Is there compensation or a partial refund?" },
  // unclassified-style (category set to null below), mixed realistic noise
  { category: "general_question", subject: "Re: your last message", body: "Thanks for getting back to me, that makes sense. One more thing though — can you call me tomorrow?" },
  { category: "general_question", subject: "Urgent!!!", body: "Nothing is working and I have a client demo in an hour. Please help ASAP." },
  { category: "technical_question", subject: "Bug report: layout broken on small screens", body: "On my phone the settings page overflows horizontally and the Save button is unreachable." },
  { category: "refund_request", subject: "Billing problem", body: "Something is off with my last invoice, the amount doesn't match what I was quoted." },
];

const senders: Array<{ name: string | null; email: string }> = [
  { name: "Olivia Martin", email: "olivia.martin@gmail.com" },
  { name: "Liam Johnson", email: "liam.johnson@outlook.com" },
  { name: "Noah Williams", email: "noah.w@acmecorp.com" },
  { name: "Emma Brown", email: "emma.brown@northwind.io" },
  { name: "Ava Davis", email: "ava.davis@yahoo.com" },
  { name: "Sophia Miller", email: "sophia@bluepeak.design" },
  { name: "Mason Garcia", email: "m.garcia@lumenlabs.com" },
  { name: "Isabella Rodriguez", email: "isabella.rodriguez@gmail.com" },
  { name: "Lucas Wilson", email: "lucas.wilson@fabrikam.com" },
  { name: "Mia Anderson", email: "mia.anderson@proton.me" },
  { name: "Ethan Thomas", email: "ethan.t@brightside.co" },
  { name: "Charlotte Taylor", email: "charlotte.taylor@hotmail.com" },
  { name: "Aarav Patel", email: "aarav.patel@techsolutions.in" },
  { name: "Priya Sharma", email: "priya.sharma@gmail.com" },
  { name: "Yuki Tanaka", email: "yuki.tanaka@tanaka-sekkei.jp" },
  { name: "Hans Müller", email: "hans.mueller@gmx.de" },
  { name: "Sofia Rossi", email: "sofia.rossi@libero.it" },
  { name: "Olga Kovalenko", email: "olga.kovalenko@ukr.net" },
  { name: "Mateo Fernández", email: "mateo.fernandez@gmail.com" },
  { name: "Chloé Dubois", email: "chloe.dubois@orange.fr" },
  { name: "Amara Okafor", email: "amara.okafor@kora.ng" },
  { name: "Jack O'Connor", email: "jack.oconnor@gmail.com" },
  { name: "Hannah Lee", email: "hannah.lee@contoso.com" },
  { name: "Daniel Kim", email: "daniel.kim@kimandsons.com" },
  { name: "Grace Nguyen", email: "grace.nguyen@icloud.com" },
  { name: null, email: "info@greenleaf-cafe.com" },
  { name: null, email: "accounting@harborlogistics.com" },
  { name: null, email: "j.smith1984@gmail.com" },
  { name: null, email: "orders@pixelforge.studio" },
  { name: null, email: "no-reply@vendor-portal.net" },
];

// Small deterministic PRNG so reruns generate identical data
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261008);
const pick = <T,>(items: T[]) => items[Math.floor(rand() * items.length)]!;

function pickStatus(ageDays: number): TicketStatus {
  // Older tickets are more likely to be finished
  const r = rand();
  if (ageDays > 25) return r < 0.2 ? "open" : r < 0.6 ? "resolved" : "closed";
  if (ageDays > 7) return r < 0.45 ? "open" : r < 0.8 ? "resolved" : "closed";
  return r < 0.8 ? "open" : r < 0.95 ? "resolved" : "closed";
}

async function main() {
  const now = Date.now();
  const data = Array.from({ length: TICKET_COUNT }, (_, i) => {
    const template = templates[i % templates.length]!;
    // Templates repeat after one pass; vary the subject so rows stay distinguishable
    const round = Math.floor(i / templates.length);
    const subject =
      round === 0
        ? template.subject
        : round === 1
          ? `${template.subject} (ref #${10000 + Math.floor(rand() * 90000)})`
          : `Re: ${template.subject}`;
    const sender = pick(senders);
    const ageDays = rand() * SPREAD_DAYS;
    const createdAt = new Date(now - ageDays * 24 * 60 * 60 * 1000);
    return {
      subject,
      body: template.body,
      fromEmail: sender.email,
      fromName: sender.name,
      status: pickStatus(ageDays),
      // ~15% not classified yet
      category: rand() < 0.15 ? null : template.category,
      messageId: `<seed-ticket-${i + 1}@seed.helpdesk.local>`,
      createdAt,
      updatedAt: createdAt,
    };
  });

  // messageId is unique, so rerunning the seed never duplicates tickets
  const { count } = await prisma.ticket.createMany({ data, skipDuplicates: true });
  console.log(`Seeded ${count} new tickets (${TICKET_COUNT - count} already existed).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
