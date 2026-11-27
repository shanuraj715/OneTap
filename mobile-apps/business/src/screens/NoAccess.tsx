import { Empty, Screen } from "@/ui";

/** Shown when a person opens something their role doesn't hold (the server would refuse it as well). */
export function NoAccess({ title = "Not available" }: { title?: string }) {
  return (
    <Screen title={title} testID="no-access"><Empty icon="lock" title="Your role doesn't include this" message="Ask the store owner if you need it." /></Screen>
  );
}
