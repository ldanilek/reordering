# Reordering and page breaks

This project implements two features on a list.

The features are independent; they can be implemented separately using the patterns in this repo. I just found their interaction interesting.

## User-defined ordering

Users can insert anywhere in the list, as well as update and delete items. Users can reorder items in the list with drag-and-drop.

## Page breaks

Instead of the typical infinite-scroll pagination which Convex supports with `.paginate()`, this repo maintains stable page breaks between pages. You can skip to an arbitrary page by its index.

As items are inserted, deleted, and moved between pages, the pages are automatically split or merged to keep them a reasonable length. In this repo, that length is between 2-4 items to illustrate the behavior, but in a real app it would be more like 50-100 items.

# How it works

The user-defined ordering uses LexoRank https://www.npmjs.com/package/lexorank strings.

The page breaks are updated when a page is changed and becomes too large or too small.

# Try it out

Clone this repo.

```sh
npm install
npm run dev
```

The app should open in the browser.

- Create items by clicking the "+" buttons.
- Move between pages by clicking page numbers at the top.
- Drag and drop items to reorder.
- Drag and drop to the bottom of a (non-final) page to move an item to the next page.
- Double click an item to edit it. Hit "Enter" to save, or "Escape" to cancel.
- Save an item as empty to delete it.
