/** Relative Mongolian "ago" string for admin queues. */
export function timeAgo(date: Date): string {
  const sec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (sec < 60) return "саяхан";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} мин`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} цаг`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} өдөр`;
  const mon = Math.floor(day / 30);
  return `${mon} сар`;
}
