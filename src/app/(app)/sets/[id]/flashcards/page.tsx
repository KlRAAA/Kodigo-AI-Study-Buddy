import { StudyPage } from "../study-page";

export default async function FlashcardsPage({ params }: PageProps<"/sets/[id]/flashcards">) {
  return <StudyPage id={(await params).id} mode="flashcards" />;
}
