"use client";

import { Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { ErrorMessage } from "@/components/form";
import { Button, Input, Label, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  addCardAction,
  deleteCardAction,
  toggleStarAction,
  updateCardAction,
  type StudyCard,
} from "@/server/actions/sets";
import type { ErrorCode } from "@/server/actions/result";

type Draft = { term: string; definition: string; example: string };
const emptyDraft: Draft = { term: "", definition: "", example: "" };

export function CardEditor({ setId, initial }: { setId: string; initial: StudyCard[] }) {
  const t = useTranslations("set");
  const [cards, setCards] = useState(initial);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [pending, startTransition] = useTransition();

  function startEdit(card: StudyCard | null) {
    setError(null);
    setEditingId(card ? card.id : "new");
    setDraft(card ? { term: card.term, definition: card.definition, example: card.example ?? "" } : emptyDraft);
  }

  function save() {
    startTransition(async () => {
      const input = { term: draft.term, definition: draft.definition, example: draft.example || undefined };
      if (editingId === "new") {
        const res = await addCardAction(setId, input);
        if (!res.ok) return setError(res.error);
        setCards((prev) => [...prev, res.data]);
      } else if (editingId) {
        const res = await updateCardAction(editingId, input);
        if (!res.ok) return setError(res.error);
        setCards((prev) =>
          prev.map((c) => (c.id === editingId ? { ...c, ...draft, example: draft.example || null } : c)),
        );
      }
      setEditingId(null);
    });
  }

  function toggleStar(card: StudyCard) {
    setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, starred: !c.starred } : c)));
    startTransition(async () => {
      const res = await toggleStarAction(card.id, !card.starred);
      if (!res.ok) {
        setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, starred: card.starred } : c)));
        setError(res.error);
      }
    });
  }

  function remove(card: StudyCard) {
    if (!window.confirm(t("confirmDeleteCard"))) return;
    startTransition(async () => {
      const res = await deleteCardAction(card.id);
      if (res.ok) setCards((prev) => prev.filter((c) => c.id !== card.id));
      else setError(res.error);
    });
  }

  const form = (
    <div className="space-y-3 rounded-2xl border-2 border-primary bg-surface p-4">
      <div>
        <Label htmlFor="card-term">{t("term")}</Label>
        <Input id="card-term" value={draft.term} maxLength={300} onChange={(e) => setDraft({ ...draft, term: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="card-def">{t("definition")}</Label>
        <Textarea id="card-def" rows={3} value={draft.definition} maxLength={1500} onChange={(e) => setDraft({ ...draft, definition: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="card-example">{t("example")}</Label>
        <Input id="card-example" value={draft.example} maxLength={800} onChange={(e) => setDraft({ ...draft, example: e.target.value })} />
      </div>
      <div className="flex gap-2">
        <Button className="flex-1" disabled={pending || !draft.term.trim() || !draft.definition.trim()} onClick={save}>
          {t("save")}
        </Button>
        <Button variant="secondary" className="flex-1" onClick={() => setEditingId(null)}>
          {t("cancel")}
        </Button>
      </div>
    </div>
  );

  return (
    <section aria-labelledby="cards-heading" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 id="cards-heading" className="text-lg font-black">
          {t("cards", { count: cards.length })}
        </h2>
        <Button variant="secondary" size="sm" onClick={() => startEdit(null)} disabled={editingId !== null}>
          <Plus aria-hidden className="size-4" /> {t("addCard")}
        </Button>
      </div>
      <ErrorMessage code={error} />
      {editingId === "new" && form}
      <ul className="space-y-2">
        {cards.map((card) =>
          editingId === card.id ? (
            <li key={card.id}>{form}</li>
          ) : (
            <li key={card.id} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-black break-words">{card.term}</p>
                  <p className="mt-1 break-words text-muted">{card.definition}</p>
                  {card.example && <p className="mt-1 text-sm break-words italic">{card.example}</p>}
                </div>
                <div className="flex shrink-0 flex-col">
                  <button
                    type="button"
                    aria-label={card.starred ? t("unstar") : t("star")}
                    aria-pressed={card.starred}
                    onClick={() => toggleStar(card)}
                    className="flex size-11 items-center justify-center rounded-xl active:bg-surface-2"
                  >
                    <Star aria-hidden className={cn("size-5", card.starred ? "fill-accent text-accent" : "text-muted")} />
                  </button>
                  <button
                    type="button"
                    aria-label={t("editCard")}
                    onClick={() => startEdit(card)}
                    className="flex size-11 items-center justify-center rounded-xl text-muted active:bg-surface-2"
                  >
                    <Pencil aria-hidden className="size-5" />
                  </button>
                  <button
                    type="button"
                    aria-label={t("deleteCard")}
                    onClick={() => remove(card)}
                    className="flex size-11 items-center justify-center rounded-xl text-muted active:bg-surface-2"
                  >
                    <Trash2 aria-hidden className="size-5" />
                  </button>
                </div>
              </div>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}
