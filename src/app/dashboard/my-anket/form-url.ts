// Анкетын нийтийн холбоос. Үндсэн анкет нь анкетын ID-гүй (өмнө хэвлэсэн QR кодтой ижил) холбоостой,
// бусад анкет ?t=<анкетын id>-тай.
export function anketFormUrl(origin: string, companyId: string, templateId: string, isDefault: boolean) {
  const base = `${origin}/active-crm/form/${companyId}`;
  return isDefault ? base : `${base}?t=${templateId}`;
}
