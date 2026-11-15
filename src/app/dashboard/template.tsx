// Dashboard-ийн хуудас солигдох бүрт шинээр mount болж хуудасны орох хөдөлгөөнийг
// (globals.css .page-enter) тоглуулна. Layout (цэс) хэвээр үлдэнэ.
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
