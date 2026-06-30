/**
 * Admin permission catalog — the SINGLE source of truth for what a dashboard
 * (staff) user can do. There are no roles: a permission is granted directly to a
 * user (stored in the `user_permissions` table). Imported by the web app (server
 * enforcement + the admin-management UI) and by the db seed (to grant a fresh
 * admin everything).
 *
 * A permission code is `<section>.<action>`; the section (text before the dot)
 * drives the nav grouping and the "select all in section" UI affordance.
 */

export type Permission =
  | "live.view"
  | "kyc.review"
  | "users.view"
  | "users.create"
  | "users.edit"
  | "users.suspend"
  | "users.reset_credentials"
  | "limits.adjust"
  | "lots.view"
  | "lots.create"
  | "lots.edit"
  | "lots.cancel"
  | "lots.rerun"
  | "lots.delete"
  | "results.view"
  | "results.mark_paid"
  | "results.permit"
  | "results.default"
  | "results.export"
  | "audit.view"
  | "admins.manage";

export interface PermissionGroup {
  /** section key (text before the dot) */
  key: string;
  /** section label (Mongolian) */
  label: string;
  /** the route this section's "view" permission unlocks */
  path: string;
  /** the permission that gates entry/visibility of the section */
  viewPermission: Permission;
  permissions: { key: Permission; label: string }[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    key: "live",
    label: "Шууд хяналт",
    path: "/admin",
    viewPermission: "live.view",
    permissions: [{ key: "live.view", label: "Шууд дуудлага хянах" }],
  },
  {
    key: "kyc",
    label: "KYC",
    path: "/admin/kyc",
    viewPermission: "kyc.review",
    permissions: [{ key: "kyc.review", label: "KYC хүсэлт батлах / татгалзах" }],
  },
  {
    key: "users",
    label: "Хэрэглэгчид",
    path: "/admin/users",
    viewPermission: "users.view",
    permissions: [
      { key: "users.view", label: "Хэрэглэгч жагсаалт / дэлгэрэнгүй харах" },
      { key: "users.create", label: "Шинэ хэрэглэгч үүсгэх" },
      { key: "users.edit", label: "Мэдээлэл / шифр засах" },
      { key: "users.suspend", label: "Түр хаах / сэргээх" },
      { key: "users.reset_credentials", label: "Нэвтрэх мэдээлэл сэргээх" },
    ],
  },
  {
    key: "limits",
    label: "Лимит",
    path: "/admin/limits",
    viewPermission: "limits.adjust",
    permissions: [{ key: "limits.adjust", label: "Лимит олгох / нэмэх / хасах" }],
  },
  {
    key: "lots",
    label: "Лот",
    path: "/admin/lots",
    viewPermission: "lots.view",
    permissions: [
      { key: "lots.view", label: "Лот жагсаалт / монитор харах" },
      { key: "lots.create", label: "Лот үүсгэх" },
      { key: "lots.edit", label: "Лот засах" },
      { key: "lots.cancel", label: "Лот цуцлах" },
      { key: "lots.rerun", label: "Лот дахин зарлах" },
      { key: "lots.delete", label: "Лот устгах" },
    ],
  },
  {
    key: "results",
    label: "Үр дүн",
    path: "/admin/results",
    viewPermission: "results.view",
    permissions: [
      { key: "results.view", label: "Үр дүн харах" },
      { key: "results.mark_paid", label: "Төлбөр төлсөн гэж тэмдэглэх" },
      { key: "results.permit", label: "Эрхийн бичиг олгох" },
      { key: "results.default", label: "Ялагчийг төлбөргүй болгох" },
      { key: "results.export", label: "Экспорт хийх" },
    ],
  },
  {
    key: "audit",
    label: "Аудит",
    path: "/admin/audit",
    viewPermission: "audit.view",
    permissions: [{ key: "audit.view", label: "Аудит лог харах" }],
  },
  {
    key: "admins",
    label: "Админ эрх",
    path: "/admin/admins",
    viewPermission: "admins.manage",
    permissions: [{ key: "admins.manage", label: "Дашбоард хэрэглэгч ба эрх удирдах" }],
  },
];

/** Every permission code, flattened. */
export const ALL_PERMISSIONS: Permission[] = PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.key),
);

const PERMISSION_SET = new Set<string>(ALL_PERMISSIONS);

/** Is this string a known permission code? */
export function isPermission(value: string): value is Permission {
  return PERMISSION_SET.has(value);
}

/** Human label for a permission code (falls back to the raw code). */
export function permissionLabel(code: string): string {
  for (const g of PERMISSION_GROUPS) {
    const p = g.permissions.find((x) => x.key === code);
    if (p) return p.label;
  }
  return code;
}
