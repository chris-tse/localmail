import { SqliteClient } from "@effect/sql-sqlite-bun";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import { Effect } from "effect";
import { ulid } from "ulid";

const seed = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  // Check if already seeded
  const existing = yield* sql<{ count: number }>`SELECT COUNT(*) as count FROM accounts`;
  const isEmpty = existing.length === 0 || existing[0]?.count === 0;
  // biome-ignore lint/plugin: seed script is imperative by design
  if (!isEmpty) {
    console.log("Database already seeded, skipping.");
    return;
  }

  console.log("Seeding database...");

  // --- Accounts ---
  const account1Id = ulid();
  const account2Id = ulid();

  yield* sql`
    INSERT INTO accounts (id, name, email, provider, username, imap_host, imap_port, imap_secure, smtp_host, smtp_port, smtp_secure, smtp_starttls, auth_type, color, sort_order)
    VALUES
      (${account1Id}, 'Personal Gmail', 'alex.chen@gmail.com', 'gmail', 'alex.chen@gmail.com', 'imap.gmail.com', 993, 1, 'smtp.gmail.com', 465, 1, 0, 'oauth2', '#EA4335', 0),
      (${account2Id}, 'Work Outlook', 'a.chen@contoso.com', 'outlook', 'a.chen@contoso.com', 'outlook.office365.com', 993, 1, 'smtp.office365.com', 587, 0, 1, 'oauth2', '#0078D4', 1)
  `;

  // --- Folders ---
  const folderDefs = [
    { accountId: account1Id, path: "INBOX", name: "Inbox", role: "inbox", order: 0 },
    { accountId: account1Id, path: "[Gmail]/Sent Mail", name: "Sent", role: "sent", order: 1 },
    { accountId: account1Id, path: "[Gmail]/Drafts", name: "Drafts", role: "drafts", order: 2 },
    { accountId: account1Id, path: "[Gmail]/Trash", name: "Trash", role: "trash", order: 3 },
    { accountId: account1Id, path: "[Gmail]/Spam", name: "Spam", role: "spam", order: 4 },
    { accountId: account2Id, path: "INBOX", name: "Inbox", role: "inbox", order: 0 },
    { accountId: account2Id, path: "Sent Items", name: "Sent", role: "sent", order: 1 },
    { accountId: account2Id, path: "Drafts", name: "Drafts", role: "drafts", order: 2 },
    { accountId: account2Id, path: "Deleted Items", name: "Trash", role: "trash", order: 3 },
  ];

  const folderIds: Record<string, string> = {};
  for (const f of folderDefs) {
    const id = ulid();
    folderIds[`${f.accountId}:${f.role}`] = id;
    yield* sql`
      INSERT INTO folders (id, account_id, path, name, role, delimiter, sort_order, total_messages, unread_messages)
      VALUES (${id}, ${f.accountId}, ${f.path}, ${f.name}, ${f.role}, '/', ${f.order}, 0, 0)
    `;
  }

  // --- Mock senders ---
  const senders = [
    { name: "Sarah Martinez", address: "sarah.martinez@example.com" },
    { name: "James Liu", address: "james.liu@techcorp.io" },
    { name: "Priya Patel", address: "priya@designstudio.co" },
    { name: "Mike O'Brien", address: "mobrien@university.edu" },
    { name: "Elena Volkov", address: "elena.v@startupmail.com" },
    { name: "David Kim", address: "d.kim@bigcompany.com" },
    { name: "Rachel Green", address: "rachel.g@agency.net" },
    { name: "Tom Nakamura", address: "tom.n@freelance.dev" },
    { name: "Lisa Chang", address: "l.chang@nonprofit.org" },
    { name: "Carlos Ruiz", address: "carlos@devshop.io" },
  ];

  interface MockMessage {
    subject: string;
    bodyText: string;
    bodyHtml?: string;
    threadGroup?: string;
  }

  const mockMessages: MockMessage[] = [
    {
      subject: "Q3 Project Timeline Review",
      bodyText:
        "Hi Alex,\n\nI've put together the Q3 timeline for the redesign project. Could you review and let me know if the milestones align with the engineering schedule?\n\nKey dates:\n- Design review: July 15\n- Frontend prototype: August 1\n- User testing: August 20\n- Launch: September 10\n\nLet me know your thoughts.\n\nBest,\nSarah",
      threadGroup: "q3-timeline",
    },
    {
      subject: "Re: Q3 Project Timeline Review",
      bodyText:
        "Sarah,\n\nTimeline looks good overall. The Aug 1 prototype date might be tight if we're also handling the API migration. Can we push that to Aug 8?\n\nAlso, who's handling the user testing coordination?\n\n- Alex",
      threadGroup: "q3-timeline",
    },
    {
      subject: "Re: Q3 Project Timeline Review",
      bodyText:
        "Good point on the prototype date. Aug 8 works. I'll coordinate with Priya on user testing — she has the research panel ready.\n\nUpdated timeline attached (not really, this is mock data).\n\nSarah",
      threadGroup: "q3-timeline",
    },
    {
      subject: "New deployment pipeline ready for review",
      bodyText:
        "Team,\n\nThe new CI/CD pipeline is set up in the staging environment. Key changes:\n\n1. Build times reduced from 8min to 3min\n2. Added automatic rollback on health check failure\n3. Blue-green deployments enabled\n\nPlease test with your feature branches this week.\n\nJames",
    },
    {
      subject: "Design system update — new component library",
      bodyText:
        "Hi all,\n\nThe updated design system is live in Figma. Notable additions:\n\n- Data table component with sorting/filtering\n- Updated color palette (better contrast ratios)\n- New icon set (200+ icons)\n- Dark mode variants for all components\n\nPriya",
      bodyHtml:
        "<h2>Design System Update</h2><p>The updated design system is live in Figma.</p><ul><li>Data table component with sorting/filtering</li><li>Updated color palette</li><li>New icon set (200+ icons)</li><li>Dark mode variants</li></ul>",
    },
    {
      subject: "Office hours cancelled this Thursday",
      bodyText:
        "Hey Alex,\n\nJust a heads up — I need to cancel office hours this Thursday. Faculty meeting got moved to the same time slot.\n\nWe can reschedule to Friday 2-3pm if that works for you.\n\nMike",
    },
    {
      subject: "Seed funding update — we closed!",
      bodyText:
        "Alex!!\n\nWe just closed our seed round! $2.5M led by Horizon Ventures. Couldn't have done it without your advice on the technical architecture section of the pitch deck.\n\nCelebration dinner next week? My treat.\n\nElena",
    },
    {
      subject: "Performance review feedback request",
      bodyText:
        "Hi Alex,\n\nAs part of the Q2 review cycle, I'd appreciate your feedback on my contributions to the platform team. The form is in Workday under 'Peer Reviews'.\n\nDeadline is end of this week.\n\nThanks,\nDavid",
    },
    {
      subject: "Campaign analytics report — June",
      bodyText:
        "Alex,\n\nAttached is the June campaign performance report. Highlights:\n\n- Email open rate: 34% (+5% from May)\n- Click-through: 8.2%\n- Conversion: 2.1%\n- Top performer: 'Summer Launch' series\n\nRachel",
    },
    {
      subject: "Invoice #1087 — Website maintenance (June)",
      bodyText:
        "Hi Alex,\n\nPlease find attached invoice #1087 for June website maintenance.\n\nTotal: $1,200.00\nDue: July 15\n\nTom",
    },
    {
      subject: "Volunteer opportunity — Code for Good hackathon",
      bodyText:
        "Dear Alex,\n\nWe're organizing our annual Code for Good hackathon on August 15-16. We'd love to have you as a mentor for the student teams.\n\nThis year's focus: building tools for local food banks.\n\nLisa",
    },
    {
      subject: "Bug report: API rate limiting not working",
      bodyText:
        "Hey Alex,\n\nFound an issue with the rate limiter. It's counting OPTIONS preflight requests toward the limit, which means CORS-enabled endpoints hit the ceiling at ~50% of expected throughput.\n\nI've got a fix ready — PR #342. Can you review?\n\nCarlos",
      threadGroup: "bug-rate-limit",
    },
    {
      subject: "Re: Bug report: API rate limiting not working",
      bodyText:
        "Nice catch Carlos. I'll review the PR today. We should also add a test case for this — I don't think our rate limit tests cover preflight requests at all.\n\n- Alex",
      threadGroup: "bug-rate-limit",
    },
    {
      subject: "Lunch next Tuesday?",
      bodyText:
        "Hey! Long time no chat. Want to grab lunch next Tuesday? That new ramen place on 5th opened and I heard it's amazing.\n\n- James",
    },
    {
      subject: "Your subscription is expiring",
      bodyText:
        "Hi Alex,\n\nYour annual subscription to DevTools Pro expires on July 30. Renew now to keep access.\n\nRenewal price: $199/year (20% off with code RENEW20)\n\nDevTools Pro Team",
      bodyHtml:
        "<div style='font-family: sans-serif'><h2>Your subscription is expiring</h2><p>Expires <strong>July 30</strong>.</p><p>Renewal: <strong>$199/year</strong> (code <code>RENEW20</code>)</p></div>",
    },
    {
      subject: "Meeting notes — Platform sync (June 28)",
      bodyText:
        "Hi team,\n\nNotes from today's sync:\n\n1. Database migration to PostgreSQL — on track for July 15\n2. API v2 deprecation — extended to August 31\n3. New hire onboarding — Carlos joining July 5\n4. Incident retrospective scheduled for Monday\n\nAction items:\n- Alex: finalize migration runbook\n- James: update API v2 deprecation docs\n\nSarah",
    },
    {
      subject: "Recommended reading: Designing Data-Intensive Applications",
      bodyText:
        "Alex,\n\nJust finished 'Designing Data-Intensive Applications' by Martin Kleppmann. Given the work you're doing on the sync engine, chapters 5 (Replication) and 7 (Transactions) are incredibly relevant.\n\nHappy to lend you my copy.\n\nMike",
    },
    {
      subject: "Updated onboarding checklist",
      bodyText:
        "Hi Alex,\n\nI've updated the engineering onboarding checklist based on your feedback. Can you do a final review before I publish?\n\nDavid",
    },
    {
      subject: "Quick question about the caching layer",
      bodyText:
        "Hey Alex,\n\nI'm implementing search autocomplete and wondering about the caching strategy. Should I use Redis or client-side cache with react-query?\n\nElena",
    },
    {
      subject: "Team offsite planning — August",
      bodyText:
        "Hi everyone,\n\nWe're planning the Q3 team offsite for August 25-27. Please fill out the preference survey by July 10.\n\nRachel",
    },
    {
      subject: "Security audit findings — action needed",
      bodyText:
        "Alex,\n\nThe external security audit wrapped up:\n\n- 2 Critical (auth token exposure in logs, SQL injection in search)\n- 5 Medium (header misconfigs)\n- 8 Low (informational)\n\nCritical items need patches this sprint. Can you own the auth token issue?\n\nCarlos",
      threadGroup: "security-audit",
    },
    {
      subject: "Re: Security audit findings — action needed",
      bodyText:
        "On it. The auth token in logs issue is from the debug middleware — I'll strip sensitive fields from the request logger.\n\nShould have a PR up by EOD.\n\n- Alex",
      threadGroup: "security-audit",
    },
  ];

  // --- Seed messages ---
  const now = Date.now();
  const DAY = 86400000;
  let uidCounter = 1;
  const threadIds: Record<string, string> = {};

  // biome-ignore lint/style/noNonNullAssertion: folder IDs are set in the loop above
  const inboxId1 = folderIds[`${account1Id}:inbox`]!;
  // biome-ignore lint/style/noNonNullAssertion: folder IDs are set in the loop above
  const inboxId2 = folderIds[`${account2Id}:inbox`]!;
  let totalUnread1 = 0;
  let totalUnread2 = 0;
  let totalMessages1 = 0;
  let totalMessages2 = 0;

  for (let i = 0; i < mockMessages.length; i++) {
    // biome-ignore lint/style/noNonNullAssertion: bounded by loop
    const msg = mockMessages[i]!;
    // biome-ignore lint/style/noNonNullAssertion: bounded by modulo
    const sender = senders[i % senders.length]!;
    const isAccount1 = i < 14;
    // biome-ignore lint/plugin: seed script is imperative by design
    const accountId = isAccount1 ? account1Id : account2Id;
    const folderId = isAccount1 ? inboxId1 : inboxId2;
    const accountEmail = isAccount1 ? "alex.chen@gmail.com" : "a.chen@contoso.com";
    const msgId = ulid();
    const internetMsgId = `<${msgId}@localmail.mock>`;

    let threadId: string;
    if (msg.threadGroup) {
      if (!threadIds[msg.threadGroup]) {
        threadIds[msg.threadGroup] = ulid();
      }
      // biome-ignore lint/style/noNonNullAssertion: set on the line above
      threadId = threadIds[msg.threadGroup]!;
    } else {
      threadId = ulid();
    }

    const daysBack = 30 - i;
    const dateStr = new Date(now - daysBack * DAY).toISOString();
    const isRead = Math.random() > 0.4 ? 1 : 0;
    const isStarred = Math.random() > 0.8 ? 1 : 0;
    const fromAddr = JSON.stringify({ name: sender.name, address: sender.address });
    const toAddr = JSON.stringify([{ name: "Alex Chen", address: accountEmail }]);
    const inReplyTo = msg.threadGroup && i > 0 ? `<prev-${msg.threadGroup}@localmail.mock>` : null;

    if (isAccount1) {
      totalMessages1++;
      if (!isRead) totalUnread1++;
    } else {
      totalMessages2++;
      if (!isRead) totalUnread2++;
    }

    yield* sql`
      INSERT INTO messages (id, account_id, folder_id, uid, internet_message_id, thread_id, in_reply_to, subject, from_address, to_addresses, date, snippet, body_text, body_html, has_body, is_read, is_starred, received_at)
      VALUES (${msgId}, ${accountId}, ${folderId}, ${uidCounter++}, ${internetMsgId}, ${threadId}, ${inReplyTo}, ${msg.subject}, ${fromAddr}, ${toAddr}, ${dateStr}, ${msg.bodyText.slice(0, 150)}, ${msg.bodyText}, ${msg.bodyHtml ?? null}, 1, ${isRead}, ${isStarred}, ${dateStr})
    `;

    // Attachment metadata for invoice and report messages
    if (msg.subject.includes("Invoice") || msg.subject.includes("analytics report")) {
      const attId = ulid();
      const filename = msg.subject.includes("Invoice")
        ? "invoice-1087.pdf"
        : "june-campaign-report.xlsx";
      const contentType = msg.subject.includes("Invoice")
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      const size = msg.subject.includes("Invoice") ? 84200 : 256000;

      yield* sql`
        INSERT INTO attachments (id, message_id, filename, content_type, size_bytes, part_id, is_inline, disposition)
        VALUES (${attId}, ${msgId}, ${filename}, ${contentType}, ${size}, '2', 0, 'attachment')
      `;
    }
  }

  // Update folder counts
  yield* sql`UPDATE folders SET total_messages = ${totalMessages1}, unread_messages = ${totalUnread1} WHERE id = ${inboxId1}`;
  yield* sql`UPDATE folders SET total_messages = ${totalMessages2}, unread_messages = ${totalUnread2} WHERE id = ${inboxId2}`;

  console.log(`Seeded:`);
  console.log(`  2 accounts`);
  console.log(`  ${folderDefs.length} folders`);
  console.log(`  ${mockMessages.length} messages`);
  console.log(`  ${totalUnread1 + totalUnread2} unread`);
  console.log("Done!");
});

// Run with a real SQLite client
const SqliteLive = SqliteClient.layer({ filename: "./data/localmail.db" });

Effect.runPromise(seed.pipe(Effect.provide(SqliteLive))).catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
