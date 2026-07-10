import { MotoristasSubNav } from "@/components/drivers/MotoristasSubNav";

export default function MotoristasLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4 p-1">
      <MotoristasSubNav />
      {children}
    </div>
  );
}
