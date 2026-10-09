import { MoneyPageSkeleton } from "@/components/host/MoneyPageSkeleton";

export default function HostPayoutsLoading() {
  return <MoneyPageSkeleton label="Loading payouts" tiles={3} />;
}
