import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { pickRank } from "./rank";
import { rankAdded, rankRemoved } from "./pages";
import { LexoRank } from "lexorank";

export const listTodos = query({
  args: {},
  handler: async (ctx, _args) => {
    return await ctx.db.query("todos").withIndex("rank").collect();
  },
});

export const createTodo = mutation({
  args: {
    text: v.string(),
    after: v.optional(v.id("todos")),
    before: v.optional(v.id("todos")),
  },
  handler: async (ctx, args) => {
    const rank = await pickRank(
      ctx.db,
      args.after ?? null,
      args.before ?? null
    );
    await ctx.db.insert("todos", {
      text: args.text,
      rank: rank.toString(),
    });
    await rankAdded(ctx.db, rank);
  },
});

export const moveTodo = mutation({
  args: {
    id: v.id("todos"),
    after: v.optional(v.id("todos")),
    before: v.optional(v.id("todos")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Todo not found");
    }
    const rank = await pickRank(
      ctx.db,
      args.after ?? null,
      args.before ?? null
    );
    await rankRemoved(ctx.db, LexoRank.parse(existing.rank));
    await ctx.db.patch(args.id, { rank: rank.toString() });
    await rankAdded(ctx.db, rank);
  },
});

export const updateTodo = mutation({
  args: {
    id: v.id("todos"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { text: args.text });
  },
});

export const deleteTodo = mutation({
  args: {
    id: v.id("todos"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Todo not found");
    }
    await ctx.db.delete(args.id);
    await rankRemoved(ctx.db, LexoRank.parse(existing.rank));
  },
});
