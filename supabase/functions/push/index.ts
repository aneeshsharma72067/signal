// Signal — `push` edge function.
// Invoked by the pg_net triggers in migration 0020 (one POST per event row).
// Resolves the recipient's Expo push tokens and sends via the Expo Push API.
//
// Body: { kind: 'notification' | 'message', record: <the inserted row> }
//   notification → { recipient_id, actor_id, type, emoji, voice_note_id, ... }
//   message      → { conversation_id, sender_id, ... } (recipient resolved here)
//
// Auth: called only by the DB trigger with the service-role key, so it uses a
// service-role client (bypasses RLS) to read tokens + usernames across users.
//
// Stale-token cleanup: Expo returns per-message tickets; a `DeviceNotRegistered`
// error means the token is dead, so we delete it. Keeps the table from rotting.

import { createClient } from "jsr:@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const CHUNK = 100; // Expo accepts at most 100 messages per request.

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Uppercased to match the app's identity styling (see NotificationsScreen).
function copyForNotification(type: string, who: string, emoji?: string | null) {
  switch (type) {
    case "reaction":
      return { title: "New reaction", body: `${who} reacted ${emoji ?? ""} to your note` };
    case "follow":
      return { title: "New follower", body: `${who} followed you` };
    case "note":
      return { title: "New note", body: `${who} posted a new note` };
    case "reply":
      return { title: "New reply", body: `${who} replied to your note` };
    default:
      return { title: "Signal", body: who };
  }
}

async function usernameOf(id: string): Promise<string> {
  const { data } = await supabase.from("users").select("username").eq("id", id).maybeSingle();
  return (data?.username ?? "someone").toUpperCase();
}

// Resolve { recipientId, message, data } for the incoming event, or null to skip.
async function resolve(kind: string, record: Record<string, unknown>) {
  if (kind === "notification") {
    const recipientId = record.recipient_id as string;
    const who = await usernameOf(record.actor_id as string);
    const { title, body } = copyForNotification(
      record.type as string,
      who,
      record.emoji as string | null,
    );
    // `data` drives deep-linking when the user taps the notification.
    return {
      recipientId,
      title,
      body,
      data: { type: record.type, voiceNoteId: record.voice_note_id ?? null },
    };
  }

  if (kind === "message") {
    const conversationId = record.conversation_id as string;
    const senderId = record.sender_id as string;
    const { data: convo } = await supabase
      .from("conversations")
      .select("user_a, user_b")
      .eq("id", conversationId)
      .maybeSingle();
    if (!convo) return null;
    // Recipient is the participant who is not the sender.
    const recipientId = convo.user_a === senderId ? convo.user_b : convo.user_a;
    const who = await usernameOf(senderId);
    return {
      recipientId,
      title: "New voice message",
      body: `${who} sent you a voice message`,
      data: { type: "message", conversationId },
    };
  }

  return null;
}

Deno.serve(async (req) => {
  try {
    const { kind, record } = await req.json();
    const resolved = await resolve(kind, record);
    if (!resolved) return new Response("skipped", { status: 200 });

    const { recipientId, title, body, data } = resolved;

    // All of the recipient's device tokens.
    const { data: tokens } = await supabase
      .from("push_tokens")
      .select("token")
      .eq("user_id", recipientId);
    if (!tokens?.length) return new Response("no tokens", { status: 200 });

    const messages = tokens.map((t) => ({
      to: t.token,
      title,
      body,
      data,
      sound: "default",
      channelId: "default",
    }));

    // Send in chunks of 100, collect tickets to prune dead tokens.
    for (let i = 0; i < messages.length; i += CHUNK) {
      const batch = messages.slice(i, i + CHUNK);
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(batch),
      });
      const json = await res.json().catch(() => null);
      const tickets: { status: string; details?: { error?: string } }[] = json?.data ?? [];

      // A DeviceNotRegistered ticket means the token is dead → delete it.
      const dead = batch
        .filter((_, idx) => tickets[idx]?.details?.error === "DeviceNotRegistered")
        .map((m) => m.to);
      if (dead.length) {
        await supabase.from("push_tokens").delete().in("token", dead);
      }
    }

    return new Response("sent", { status: 200 });
  } catch (e) {
    console.error("push function error:", e);
    return new Response("error", { status: 500 });
  }
});
