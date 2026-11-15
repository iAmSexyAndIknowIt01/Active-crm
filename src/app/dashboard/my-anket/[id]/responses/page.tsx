import AnketResponses from '../../AnketResponses';

// Нэг анкетын ирсэн хариултууд: асуулт бүрийн хураангуй, хариу тус бүр, CSV татах
export default async function AnketResponsesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AnketResponses key={id} templateId={id} />;
}
