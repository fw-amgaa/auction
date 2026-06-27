import { AppNav } from "@/components/AppNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // balance/unread are placeholders until auth + data wiring (Phase 1+).
  return (
    <div className="min-h-screen">
      <AppNav balance={0} unread={0} />
      <div className="mx-auto max-w-6xl px-5 py-8">{children}</div>
    </div>
  );
}
