import { pageRequireInvestor } from "@/lib/auth";
import { loadLiveData } from "@/lib/cabinet-live";
import { LiveCabinet } from "@/components/live-cabinet";

export const metadata = { title: "Мой портфель" };

export default async function CabinetPage() {
  const user = await pageRequireInvestor();
  const data = await loadLiveData(user.id, user.status);
  return <LiveCabinet data={data} name={user.fullName} />;
}
