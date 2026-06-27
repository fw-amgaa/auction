export default function AdminHome() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Шууд хяналт</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Админ удирдлагын самбар. Дэлгэрэнгүй дэлгэцүүд дараагийн шатуудад нэмэгдэнэ.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          ["Идэвхтэй лот", "0"],
          ["Хүлээгдэж буй KYC", "0"],
          ["Нийт хэрэглэгч", "0"],
        ].map(([label, n]) => (
          <div key={label} className="rounded-card border border-line-cool bg-card p-5">
            <div className="text-sm text-ink-soft">{label}</div>
            <div className="tnum mt-1 text-3xl font-bold text-navy">{n}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
