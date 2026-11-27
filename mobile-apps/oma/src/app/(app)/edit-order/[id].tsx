import { useLocalSearchParams, useRouter } from "expo-router";
import { EditOrderScreen } from "@/screens/EditOrderScreen";

export default function EditOrderRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return <EditOrderScreen orderId={String(id)} onDone={() => router.back()} />;
}
