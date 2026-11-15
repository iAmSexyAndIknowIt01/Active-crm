import AnketEditor from '../AnketEditor';

// Анкет засах. ?created=1 — дөнгөж үүсгэсэн анкет (амжилтын мэдэгдэл харуулна)
export default async function EditAnketPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;
  return <AnketEditor key={id} templateId={id} justCreated={created === '1'} />;
}
