// Active CRM брэндийн лого: улаан дэвсгэртэй дугуйрсан дөрвөлжин дотор цагаан "A" тэмдэг
// (Active Intec-ийн логоны хэв маягаар). Хэмжээг className-аар (w-*, h-*) тохируулна.
export function BrandMark({ className = 'w-9 h-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="active-crm-mark-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#EF3B45" />
          <stop offset="100%" stopColor="#B71C25" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="24" fill="url(#active-crm-mark-bg)" />
      <path d="M15 84 L50 15 L85 84 Z M32 84 L50 47 L68 84 Z" fill="#fff" fillRule="evenodd" />
      <path d="M41 79 L50 61 L59 79 Z" fill="#fff" />
    </svg>
  );
}

// Тэмдэг + "Active CRM" бичвэр
export default function BrandLogo({
  markClassName = 'w-9 h-9',
  textClassName = 'text-xl',
}: {
  markClassName?: string;
  textClassName?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <BrandMark className={markClassName} />
      <span className={`font-extrabold tracking-tight text-slate-900 dark:text-white ${textClassName}`}>
        Active <span className="text-red-600 dark:text-red-500">CRM</span>
      </span>
    </span>
  );
}
