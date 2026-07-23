import { Tabs } from 'expo-router';

import BrutalTabBar from '../../src/components/BrutalTabBar';

// The three primary destinations (Feed / Notes / Me) now live in a bottom tab
// group. The header stays hidden — screens render their own AppHeader — and the
// custom BrutalTabBar replaces the default bottom nav with a floating,
// detached, neo-brutalist pill bar.
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BrutalTabBar {...props} />}>
      <Tabs.Screen name="feed" />
      <Tabs.Screen name="my-notes" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
