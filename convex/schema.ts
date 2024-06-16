// NOTE: You can remove this file. Declaring the shape
// of the database is entirely optional in Convex.
// See https://docs.convex.dev/database/schemas.

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  todos: defineTable({
    text: v.string(),
    rank: v.string(),
  }).index("rank", ["rank"]),
  pages: defineTable({
    // startRank is not inclusive.
    startRank: v.string(),
    // endRank is inclusive.
    endRank: v.string(),
    // denormalized size of the page.
    size: v.number(),
  })
    .index("startRank", ["startRank"]),
});
