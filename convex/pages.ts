import { v } from "convex/values";
import {
  DatabaseReader,
  DatabaseWriter,
  mutation,
  query,
} from "./_generated/server";
import { LexoRank } from "lexorank";
import { Id } from "./_generated/dataModel";

export const getPageCount = query({
  args: {},
  handler: async (ctx, _args) => {
    const allPages = await ctx.db
      .query("pages")
      .withIndex("startRank")
      .collect();
    return allPages.length;
  },
});

export const getPageOfTodos = query({
  args: { pageIndex: v.number() },
  handler: async (ctx, args) => {
    const allPages = await ctx.db
      .query("pages")
      .withIndex("startRank")
      .collect();
    const page = allPages[args.pageIndex];
    if (!page) {
      throw new Error(`Page ${args.pageIndex} not found`);
    }
    return await getTodosInRange(ctx.db, page.startRank, page.endRank);
  },
});

const getTodosInRange = async (
  db: DatabaseReader,
  startRank: string,
  endRank: string
) => {
  return await db
    .query("todos")
    .withIndex("rank", (q) => q.gt("rank", startRank).lte("rank", endRank))
    .collect();
};

export const bootstrapPage = mutation({
  args: {},
  handler: async (ctx, _args) => {
    const allTodos = await ctx.db.query("todos").collect();
    const firstPage = await ctx.db.query("pages").first();
    if (!firstPage) {
      const pageId = await ctx.db.insert("pages", {
        startRank: LexoRank.min().toString(),
        endRank: LexoRank.max().toString(),
        size: allTodos.length,
      });
      await checkPageSize(ctx.db, pageId);
    }
  },
});

export const MAX_PAGE_SIZE = 4;
// Excluding single-page case.
export const MIN_PAGE_SIZE = 2;

const pageForRank = async (db: DatabaseReader, rank: LexoRank) => {
  const page = await db
    .query("pages")
    .withIndex("startRank", (q) => q.lt("startRank", rank.toString()))
    .order("desc")
    .first();
  if (!page) {
    throw new Error("Page not found");
  }
  return page;
};

export const rankAdded = async (db: DatabaseWriter, rank: LexoRank) => {
  const page = await pageForRank(db, rank);
  await db.patch(page._id, { size: page.size + 1 });
  await checkPageSize(db, page._id);
};

export const rankRemoved = async (db: DatabaseWriter, rank: LexoRank) => {
  const page = await pageForRank(db, rank);
  await db.patch(page._id, { size: page.size - 1 });
  await checkPageSize(db, page._id);
};

export const checkPageSize = async (
  db: DatabaseWriter,
  pageId: Id<"pages">
) => {
  const page = await db.get(pageId);
  if (!page) return;
  if (page.size > MAX_PAGE_SIZE) {
    // Split page.
    const todosInPage = await getTodosInRange(db, page.startRank, page.endRank);
    const middleIndex = Math.floor(todosInPage.length / 2);
    const middleTodo = todosInPage[middleIndex];
    await db.patch(page._id, {
      endRank: middleTodo.rank,
      size: middleIndex + 1,
    });
    const newPageId = await db.insert("pages", {
      startRank: middleTodo.rank,
      endRank: page.endRank,
      size: todosInPage.length - middleIndex - 1,
    });
    console.log(
      `Split page of size ${page.size} (really ${todosInPage.length}) into pages of size ${middleIndex} and ${todosInPage.length - middleIndex}`
    );
    // In case the pages are still too big, call recursively.
    await checkPageSize(db, pageId);
    await checkPageSize(db, newPageId);
  } else if (page.size < MIN_PAGE_SIZE) {
    // Merge with the next page, or previous if there is no next.
    const nextPage = await db
      .query("pages")
      .withIndex("startRank", (q) => q.gt("startRank", page.startRank))
      .first();
    if (nextPage) {
      await db.patch(nextPage._id, {
        startRank: page.startRank,
        size: nextPage.size + page.size,
      });
      console.log(
        `Merged pages of size ${page.size} with next page ${nextPage.size}`
      );
      await db.delete(page._id);
      // In case the page is still too small, call recursively.
      await checkPageSize(db, nextPage._id);
    } else {
      const prevPage = await db
        .query("pages")
        .withIndex("startRank", (q) => q.lt("startRank", page.startRank))
        .order("desc")
        .first();
      if (prevPage) {
        await db.patch(prevPage._id, {
          endRank: page.endRank,
          size: prevPage.size + page.size,
        });
        await db.delete(page._id);
        console.log(
          `Merged page of size ${page.size} with previous page ${prevPage.size}`
        );
        // In case the page is still too small, call recursively.
        await checkPageSize(db, prevPage._id);
      }
    }
  }
};
