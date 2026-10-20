-- Шинэ хүснэгтүүдэд RLS идэвхжүүлэх.
-- Апп DB-д `postgres` хэрэглэгчээр (BYPASSRLS) шууд холбогддог тул RLS аппад нөлөөлөхгүй.
-- Харин Supabase REST API (anon/authenticated түлхүүр)-аар эдгээр хүснэгтийг унших, өөрчлөхийг хаана.
-- Бусад бүх public хүснэгт аль хэдийн ийм тохиргоотой (policy-гүй RLS = гаднаас хандах эрхгүй).

ALTER TABLE mt_reservation ENABLE ROW LEVEL SECURITY;
ALTER TABLE mt_reservation_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE mt_work_services ENABLE ROW LEVEL SECURITY;
