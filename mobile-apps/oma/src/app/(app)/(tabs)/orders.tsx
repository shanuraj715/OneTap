import { useRouter } from "expo-router";
import { useLayout } from "@/lib/layout";
import { OrdersScreen } from "@/screens/OrdersScreen";

export default function OrdersRoute() {
  const router = useRouter();
  const layout = useLayout();
  // an order opens its table's page (on a wide tablet the Tables tab has the side panel, so go there instead)
  return <OrdersScreen onOpenTable={layout.split ? undefined : (id) => router.push(`/table/${id}`)} />;
}
