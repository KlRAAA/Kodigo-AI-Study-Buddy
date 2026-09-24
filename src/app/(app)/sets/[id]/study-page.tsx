import { notFound } from "next/navigation";
import { StudyShell } from "@/components/study/study-shell";
import { requireUser } from "@/server/auth";
import { listCards } from "@/server/db/queries/cards";
import { getSet } from "@/server/db/queries/sets";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Server loader shared by the flashcards and learn routes. */
export async function StudyPage({ id, mode }: { id: string; mode: "flashcards" | "learn" }) {
  if (!uuid.test(id)) notFound();
  const { user } = await requireUser();
  const set = await getSet(user.id, id);
  if (!set) notFound();
  const cards = await listCards(user.id, id);
  return (
    <StudyShell
      setId={set.id}
      title={set.title}
      mode={mode}
      cards={cards.map((c) => ({
        id: c.id,
        term: c.term,
        definition: c.definition,
        example: c.example,
        starred: c.starred,
      }))}
    />
  );
}
