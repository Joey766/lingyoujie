import "server-only";

import content from "../content/editorial.json";

type EditorialDraft = {
  slug: string;
  title: string;
  body: string;
  comments: readonly string[];
};

export const editorialDrafts: Readonly<Record<string, readonly EditorialDraft[]>> = content;
