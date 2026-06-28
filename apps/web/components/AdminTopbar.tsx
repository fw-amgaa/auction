export function AdminTopbar({
  title,
  children,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex h-[60px] items-center justify-between border-b border-line-cool bg-white px-6">
      <div className="flex items-center gap-3">
        {typeof title === "string" ? (
          <h1 className="text-lg font-bold text-navy">{title}</h1>
        ) : (
          title
        )}
      </div>
      <div className="flex items-center gap-3">{children}</div>
    </div>
  );
}
