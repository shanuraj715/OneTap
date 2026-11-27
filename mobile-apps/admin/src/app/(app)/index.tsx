import { Redirect } from "expo-router";
import { APP_AREAS, areasFor } from "@/lib/access";
import { useMe } from "@/runtime";

/** The first screen after signing in: the dashboard for those who hold it, otherwise the first area their role holds. */
export default function Home() {
  const first = areasFor(useMe()).find((a) => APP_AREAS.has(a.id));
  return <Redirect href={first ? (`/${first.id}` as never) : "/more"} />;
}
