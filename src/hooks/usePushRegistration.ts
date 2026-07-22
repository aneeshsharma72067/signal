import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";

import { useAuth } from "../context/AuthContext";
import { registerForPush } from "../lib/push";

// Registers the device for push once the user is authed, and routes taps on a
// received notification to the right screen. Mount once, high in the tree
// (root layout, inside AuthProvider). Deep-link targets mirror
// NotificationsScreen's in-app tap logic.
export function usePushRegistration() {
  const { user } = useAuth();
  const router = useRouter();

  // Register this device's token whenever we have a signed-in user.
  useEffect(() => {
    if (!user) return;
    registerForPush(user.id).catch((e) => console.error("push register failed:", e));
  }, [user]);

  // Route a tapped notification to its screen. `data` is set by the edge
  // function (src/lib/push.ts mirrors the shape).
  useEffect(() => {
    function route(data: Record<string, unknown> | undefined) {
      if (!data) return;
      if (data.type === "message" && data.conversationId) {
        router.push(`/messages/${data.conversationId}`);
      } else if (data.type === "reply" && data.voiceNoteId) {
        router.push(`/thread/${data.voiceNoteId}`);
      } else {
        // reaction / follow / note → the Activity screen.
        router.push("/notifications");
      }
    }

    // App opened from a tap while backgrounded/killed.
    Notifications.getLastNotificationResponseAsync().then((res) => {
      route(res?.notification.request.content.data as Record<string, unknown>);
    });

    // App already running when the notification is tapped.
    const sub = Notifications.addNotificationResponseReceivedListener((res) => {
      route(res.notification.request.content.data as Record<string, unknown>);
    });
    return () => sub.remove();
  }, [router]);
}
