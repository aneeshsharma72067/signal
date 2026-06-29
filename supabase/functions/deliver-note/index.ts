// deliver-note — picks 5 random users (excluding the poster) and inserts a
// delivery row per user. Called from the app after a voice_note is uploaded.
//
// Uses the service-role key so the inserts bypass RLS on deliveries.
//
// Deploy: supabase functions deploy deliver-note
// Secrets needed (auto-present in hosted Functions): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    const { voice_note_id } = await req.json();
    if (!voice_note_id) {
      return json({ error: 'voice_note_id is required' }, 400);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Look up the poster so we can exclude them.
    const { data: note, error: noteErr } = await admin
      .from('voice_notes')
      .select('id, user_id')
      .eq('id', voice_note_id)
      .single();
    if (noteErr || !note) {
      return json({ error: noteErr?.message ?? 'voice note not found' }, 404);
    }

    // Candidate recipients: everyone except the poster.
    const { data: candidates, error: usersErr } = await admin
      .from('users')
      .select('id')
      .neq('id', note.user_id);
    if (usersErr) {
      return json({ error: usersErr.message }, 500);
    }

    // Shuffle (Fisher–Yates) and take up to 5.
    const pool = (candidates ?? []).map((u) => u.id);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const recipients = pool.slice(0, 5);

    if (recipients.length === 0) {
      return json({ delivery_ids: [], note: 'no other users to deliver to' }, 200);
    }

    const rows = recipients.map((uid) => ({
      voice_note_id,
      delivered_to_user_id: uid,
    }));

    const { data: inserted, error: insertErr } = await admin
      .from('deliveries')
      .insert(rows)
      .select('id');
    if (insertErr) {
      return json({ error: insertErr.message }, 500);
    }

    return json({ delivery_ids: (inserted ?? []).map((d) => d.id) }, 200);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
