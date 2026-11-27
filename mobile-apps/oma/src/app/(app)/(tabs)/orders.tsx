import { useRouter } from "expo-router";
import { OrdersScreen } from "@/screens/OrdersScreen";

export default function OrdersRoute() {
  const router = useRouter();
  // an order opens its own page: everything about it, and everything a person can do with it
  return <OrdersScreen onOpenOrder={(id) => router.push(`/order/${id}`)} />;
}
