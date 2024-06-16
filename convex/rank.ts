import { LexoRank } from "lexorank";
import { DatabaseReader } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export const pickRankBetween = async (
  db: DatabaseReader,
  afterRank: null | LexoRank,
  beforeRank: null | LexoRank
): Promise<LexoRank> => {
  let candidate = LexoRank.middle();
  if (afterRank && beforeRank) {
    candidate = afterRank.between(beforeRank);
  } else if (afterRank) {
    candidate = afterRank.genNext();
  } else if (beforeRank) {
    candidate = beforeRank.genPrev();
  } else {
    candidate = LexoRank.middle();
  }
  // Avoid two TODOs being given the same rank.
  const candidateDoc = await db
    .query("todos")
    .withIndex("rank", (q) => q.eq("rank", candidate.toString()))
    .unique();
  if (!candidateDoc) {
    // No collision.
    return candidate;
  }
  console.log("adjusting for collision with", candidateDoc);
  if (afterRank) {
    // Pick a rank closer to afterRank.
    return await pickRankBetween(db, afterRank, candidate);
  }
  return await pickRankBetween(db, candidate, beforeRank);
};

export const pickRank = async (
  db: DatabaseReader,
  after: null | Id<"todos">,
  before: null | Id<"todos">
) => {
  let afterDoc = after && (await db.get(after));
  let beforeDoc = before && (await db.get(before));
  let afterRank = afterDoc && LexoRank.parse(afterDoc.rank);
  let beforeRank = beforeDoc && LexoRank.parse(beforeDoc.rank);
  if (afterRank && !beforeRank) {
    // Try to fit it right after.
    beforeDoc = await db
      .query("todos")
      .withIndex("rank", (q) => q.gt("rank", afterRank!.toString()))
      .first();
    beforeRank = beforeDoc && LexoRank.parse(beforeDoc.rank);
  }
  if (!afterRank && beforeRank) {
    // Try to fit it right before.
    afterDoc = await db
      .query("todos")
      .withIndex("rank", (q) => q.lt("rank", beforeRank!.toString()))
      .order("desc")
      .first();
    afterRank = afterDoc && LexoRank.parse(afterDoc.rank);
  }
  return await pickRankBetween(db, afterRank, beforeRank);
};
