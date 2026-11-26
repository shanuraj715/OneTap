import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "@/ui";
import { TableDetail } from "@/screens/TableDetail";

export default function TableRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return (
    <Screen padded={false} edges={["left", "right", "bottom"]}>
      <TableDetail tableId={String(id)} onTakeOrder={(tableId) => router.push(`/take-order/${tableId}`)} />
    </Screen>
  );
}
