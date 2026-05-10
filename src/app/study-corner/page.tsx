import StudyCorner from '@/sections/StudyCorner';
import { getNcertCatalog } from '@/server/study-catalog';

export default async function StudyCornerPage() {
  const catalog = await getNcertCatalog();

  return <StudyCorner catalog={catalog} />;
}
