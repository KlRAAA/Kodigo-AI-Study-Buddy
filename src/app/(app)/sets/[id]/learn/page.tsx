import { StudyPage } from "../study-page";

export default async function LearnPage({ params }: PageProps<"/sets/[id]/learn">) {
  return <StudyPage id={(await params).id} mode="learn" />;
}
