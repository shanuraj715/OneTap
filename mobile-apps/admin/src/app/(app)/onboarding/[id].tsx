import { useLocalSearchParams } from "expo-router";
import { OnboardingForm } from "@/screens/OnboardingForm";
import { NoAccess } from "@/screens/NoAccess";
import { canDo } from "@/lib/access";
import { useMe } from "@/runtime";

export default function OnboardingPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  return canDo(me, "onboarding:manage") ? <OnboardingForm id={String(id)} /> : <NoAccess title="Onboarding" />;
}
