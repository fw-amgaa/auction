/**
 * Official wordmark (АН АГНУУРИЙН ҮНИЙН САНАЛ ДУУДАХ СИСТЕМ).
 * `chip` places it on a white rounded panel for dark surfaces (AdminNav, Login).
 */
export function Logo({ height = 34, chip = false }: { height?: number; chip?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element
  const img = <img src="/logo.png" alt="Ан агнуурын үнийн санал дуудах систем" height={height} style={{ height, width: "auto", display: "block" }} />;
  if (!chip) return img;
  return <span className="inline-flex rounded-lg bg-white px-2.5 py-1.5">{img}</span>;
}
