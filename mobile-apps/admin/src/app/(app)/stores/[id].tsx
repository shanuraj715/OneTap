import { useLocalSearchParams } from "expo-router";
import { StoreDetail } from "@/screens/StoreDetail";
import { NoAccess } from "@/screens/NoAccess";
import { canDo } from "@/lib/access";
import { useMe } from "@/runtime";

export default function StorePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  return canDo(me, "stores:read") ? <StoreDetail id={String(id)} /> : <NoAccess title="Store" />;
}
