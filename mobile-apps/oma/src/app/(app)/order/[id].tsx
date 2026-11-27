import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "@/ui";
import { OrderDetail } from "@/screens/OrderDetail";

export default function OrderRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return (
    <Screen padded={false} edges={["left", "right", "bottom"]}>
      <OrderDetail orderId={String(id)} onEdit={(orderId) => router.push(`/edit-order/${orderId}`)} onOpenTable={(tableId) => router.push(`/table/${tableId}`)} onGone={() => router.back()} />
    </Screen>
  );
}
