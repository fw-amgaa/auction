export function AppPlaceholder({ title, phase }: { title: string; phase: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">{title}</h1>
      <div className="mt-6 rounded-card border border-dashed border-line bg-card p-12 text-center">
        <div className="text-base font-semibold text-navy">{title}</div>
        <div className="mt-2 text-sm text-muted">{phase}-д хийгдэнэ.</div>
      </div>
    </div>
  );
}
