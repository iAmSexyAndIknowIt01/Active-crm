// Хэрэглэгчийн эрх (mt_user.role). Клиент (цэс) болон сервер (proxy, API) хоёуланд ашиглагдана.
//   admin    — бүх зүйл: тохиргоо, ажилчид, экспорт/импорт, устгах, үйлдлийн түүх, багц
//   manager  — харилцагч (устгахаас бусад), цаг захиалга, бүх ажил, тайлан
//   employee — зөвхөн өөрт оноогдсон ажил
export const ROLES = ['admin', 'manager', 'employee'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Админ',
  manager: 'Менежер',
  employee: 'Ажилтан',
};

// Харилцагч, захиалга, тайлан, бүх ажлыг удирдах эрхтэй
export const MANAGER_ROLES: Role[] = ['admin', 'manager'];

// DB-д таних боломжгүй утгыг хамгийн бага эрх (ажилтан) гэж үзнэ
export function normalizeRole(role: unknown): Role {
  const value = typeof role === 'string' ? role.trim().toLowerCase() : '';
  return (ROLES as readonly string[]).includes(value) ? (value as Role) : 'employee';
}

export function isManager(role: Role | undefined | null) {
  return role === 'admin' || role === 'manager';
}

// Dashboard-ийн хуудсууд: эрх бүр нээж болох замууд (admin бүгдийг нээнэ)
const PATHS: Record<Exclude<Role, 'admin'>, string[]> = {
  manager: ['/dashboard/customers', '/dashboard/reservations', '/dashboard/workshop', '/dashboard/analytics', '/dashboard/profile', '/dashboard/billing'],
  employee: ['/dashboard/workshop', '/dashboard/profile', '/dashboard/billing'],
};

export function canAccessPath(role: Role, pathname: string) {
  if (role === 'admin') return true;
  if (role === 'manager' && pathname === '/dashboard') return true;
  return PATHS[role].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Эрх нь хандаж болохгүй хуудсанд орвол шилжүүлэх нүүр хуудас
export function homePathFor(role: Role) {
  return role === 'employee' ? '/dashboard/workshop' : '/dashboard';
}
