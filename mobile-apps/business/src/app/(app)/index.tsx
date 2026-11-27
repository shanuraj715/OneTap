import { Redirect } from "expo-router";
import { areasFor } from "@/lib/access";
import { useMe } from "@/runtime";

/** The first screen after signing in: Home, or the first area the person's role holds. */
export default function Home() {
  const first = areasFor(useMe())[0];
  return <Redirect href={first ? (`/${first.id}` as never) : "/more"} />;
}
