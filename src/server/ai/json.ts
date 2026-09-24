/** Pulls a JSON value out of a model reply, tolerating ```json fences and chatter around it. */
export function extractJson(text: string): unknown {
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1]!.trim();
  // Some models think out loud before answering (e.g. <think>…</think>).
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  try {
    return JSON.parse(s);
  } catch {
    const start = s.search(/[[{]/);
    const end = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
    if (start >= 0 && end > start) return JSON.parse(s.slice(start, end + 1));
    throw new SyntaxError("No JSON found in model output");
  }
}
