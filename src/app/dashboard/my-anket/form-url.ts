// Анкетын нийтийн холбоос. Анкет бүр өөрийн ID-тай (?t=) холбоостой тул яг тэр анкет нээгдэнэ.
// (Анкетын ID-гүй хуучин холбоос, өмнө хэвлэсэн QR код серверт хадгалсан үндсэн анкетыг нээсээр байна.)
export function anketFormUrl(origin: string, companyId: string, templateId: string) {
  return `${origin}/active-crm/form/${companyId}?t=${templateId}`;
}
