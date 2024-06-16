import { Button } from "@/components/ui/button";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Link } from "@/components/typography/link";
import { useEffect, useMemo, useState } from "react";
import { Doc, Id } from "../convex/_generated/dataModel";
import { useTransition, animated, config } from 'react-spring';

type ItemType = ({
  type: "todo"
} & Doc<"todos">) | {
  type: "before" | "after" | "between";
  _id: string;
  after?: Id<"todos">;
  before?: Id<"todos">;
};

function TodoList() {
  const [pageIndex, setPageIndex] = useState(0);
  const pageCount = useQuery(api.pages.getPageCount);
  const bootstrapPage = useMutation(api.pages.bootstrapPage);

  useEffect(() => {
    if (pageCount === 0) {
      void bootstrapPage();
    }
  }, [pageCount, bootstrapPage]);

  const pageOptions = useMemo(() => {
    const options = [];
    if (!pageCount) {
      return [];
    }
    for (let i = 0; i < pageCount; i++) {
      options.push(i);
    }
    return options;
  }, [pageCount]);

  if (!pageCount) {
    return <div>Loading...</div>;
  }

  return <div>
    <div className="flex justify-center gap-4">
    { pageOptions.map((option) => (
      <Button
        key={option}
        onClick={() => setPageIndex(option)}
        variant={pageIndex === option ? "link" : "secondary"}
      >
        {option + 1}
      </Button>
    )) }
    </div>
    <TodoListPage pageIndex={pageIndex} />
  </div>;
}

function TodoListPage({ pageIndex }: { pageIndex: number }) {
  const todos = useQuery(api.pages.getPageOfTodos, { pageIndex });
  const [draggedTodo, setDraggedTodo] = useState<null | Id<"todos">>(null);

  const todosWithDividers = useMemo(() => {
    const all: ItemType[] = [];
    const todosArray = todos ?? [];
    if (todosArray.length > 0) {
      all.push({
        type: "before",
        _id: "",
        after: undefined,
        before: todosArray[0]?._id,
      });
    }
    for (let i = 0; i < todosArray.length; i++) {
      all.push({ type: "todo", ...todosArray[i] });
      if (i < todosArray.length - 1) {
        all.push({
          type: "between",
          _id: "" + i,
          after: todosArray[i]._id,
          before: todosArray[i+1]._id,
        });
      }
    }
    all.push({
      type: "after",
      _id: "",
      after: todosArray[todosArray.length - 1]?._id,
      before: undefined,
    });
    return all;
  }, [todos]);

  // This doesn't work.
  // We can get the reorders to animate, but doing so adds
  // unwanted padding between items.
  /*const transitions = useTransition(todosWithDividers, {
      keys: item => `${item.type}-${item._id}`,
      from: { transform: 'translateY(0px)' },
      enter: { transform: 'translateY(0px)' },
      update: item => ({ transform: `translateY(${todosWithDividers.indexOf(item) * 10}px)` }),
      leave: { transform: 'translateY(0px)' },
      config: { ...config.slow },
  });*/

  return <div>
  {
    todosWithDividers.map((todo) => (
      <div key={`${todo.type}-${todo._id}`}>
      { todo.type === "todo" ? (
        <Todo todo={todo} setDraggedTodo={setDraggedTodo} />
      ) : (
        <Location
          dragging={draggedTodo}
          after={todo.after}
          before={todo.before}
        />
      )}
      </div>
    ))
  }
</div>;
}

function Todo({
  todo,
  setDraggedTodo,
}: {
  todo: Doc<"todos">;
  setDraggedTodo: (id: Id<"todos"> | null) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const updateTodo = useMutation(api.todos.updateTodo);
  const deleteTodo = useMutation(api.todos.deleteTodo);

  if (isEditing) {
    return <TodoEditor
      initialText={todo.text}
      onSave={async (text) => {
        if (text.length === 0) {
          await deleteTodo({ id: todo._id });
        } else {
          await updateTodo({ id: todo._id, text });
        }
        setIsEditing(false);
      }}
      onCancel={() => setIsEditing(false)}
    />;
  }

  return <div
    draggable="true"
    onDragStart={() => {
      setDraggedTodo(todo._id);
    }}
    onDragEnd={() => {
      setDraggedTodo(null);
    }}
    onDoubleClick={() => {
      setIsEditing(true);
    }}
    className="flex items-center gap-4 dark:bg-gray-800 p-2 rounded-lg z-50"
  >
    <span>{todo.text}</span>
  </div>;
}

function Location({ dragging, after, before, onDrop } :
  {
    dragging: null | Id<"todos">;
    after?: Id<"todos">;
    before?: Id<"todos">;
    onDrop?: () => void;
  }
) {
  const [isAdding, setIsAdding] = useState(false);
  const moveTodo = useMutation(api.todos.moveTodo);

  if (isAdding && !dragging) {
    return <NewTodo
      after={after}
      before={before}
      onDone={() => setIsAdding(false)}
    />;
  }

  return <div
    onDragOver={(e) => {
      e.preventDefault();
    }}
    onDrop={() => {
      void (async () => {
        if (dragging) {
          await moveTodo({ id: dragging, after, before });
          onDrop?.();
        }
      })();
    }}
    className="text-center dark: bg-gray-900 rounded-lg cursor-pointer"
    onClick={() => {
      if (!dragging) {
        setIsAdding(true);
      }
    }}
  >
    { dragging ? "=" : "+" }
  </div>;
}

function NewTodo({
  onDone,
  before,
  after,
}: {
  onDone: () => void;
  after?: Id<"todos">;
  before?: Id<"todos">;
}) {
  const addTodo = useMutation(api.todos.createTodo);
  return <TodoEditor
    onSave={async (text) => {
      if (text.length > 0) {
        await addTodo({
          text,
          after,
          before,
        });
      }
      onDone();
    }}
    onCancel={() => {
      onDone();
    }}
  />;
}

function TodoEditor({
  initialText,
  onSave,
  onCancel,
}: {
  initialText?: string;
  onSave: (text: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initialText ?? "");

  return <div className="flex my-2">
  <input
    type="text"
    value={text}
    autoFocus
    placeholder="do laundry..."
    className="dark:bg-gray-800 flex-grow p-2 rounded-lg"
    onChange={(e) => setText(e.target.value)}
    onKeyUp={(e) => {
      if (e.key === "Enter") {
        void (async () => {
          await onSave(text);
          setText("");
        })();
      } else if (e.key === "Escape") {
        onCancel();
      }
    }}
  />
</div>;
}

function App() {
  return (
    <main className="container max-w-2xl flex flex-col gap-8">
      <h1 className="text-4xl font-extrabold my-8 text-center">
        TODO List
      </h1>
      <p>
        drag-and-drop to reorder, double-click to edit, save empty text to delete
      </p>
      <TodoList />
    </main>
  );
}

export default App;
