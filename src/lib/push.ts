// Signal — client-side push registration (Android).
// Requests notification permission, obtains the device's Expo push token, and
// upserts it into public.push_tokens so the `push` edge function can reach this
// device. Called once the user is authed (see usePushRegistration).

import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { supabase } from "./supabase";

// Foreground behaviour: show a banner + play sound even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Android requires an explicit channel; the edge function sends channelId "default".
async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
  });
}

// Register this device for push and persist its token for `userId`.
// No-ops on a simulator (no push hardware) or if permission is denied.
export async function registerForPush(userId: string): Promise<void> {
  if (!Device.isDevice) return; // Push tokens require a physical device.

  await ensureAndroidChannel();

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (status !== "granted") {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== "granted") return; // User declined — nothing to store.

  // projectId comes from app.json extra.eas.projectId (required for a token).
  const token = (await Notifications.getExpoPushTokenAsync()).data;

  // token is the PK, so an upsert refreshes user_id/updated_at if the device
  // switches accounts. updated_at set explicitly (default only fills on insert).
  await supabase.from("push_tokens").upsert(
    {
      token,
      user_id: userId,
      platform: Platform.OS,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "token" },
  );
}

// Remove this device's token on sign-out so a signed-out phone stops receiving
// pushes for the previous account. Best-effort.
export async function unregisterPush(): Promise<void> {
  if (!Device.isDevice) return;
  try {
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    await supabase.from("push_tokens").delete().eq("token", token);
  } catch {
    // Token unavailable (permission revoked) — nothing to remove.
  }
}
