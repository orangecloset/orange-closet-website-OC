import { useEffect, useRef, useState, type ReactNode } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import {
  Bold,
  ChevronDown,
  Heading,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Table2,
  Undo2,
} from "lucide-react";
import { cn } from "../lib/utils";
import { toEditorHtml } from "../../lib/richText";

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded px-1.5 text-[var(--fg-subtle)] transition-colors hover:bg-[var(--bg-subtle-hover)] hover:text-[var(--fg-base)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[var(--fg-subtle)]",
        active && "bg-[var(--bg-subtle-hover)] text-[var(--fg-base)]"
      )}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <span className="mx-0.5 h-4 w-px shrink-0 bg-[var(--border-subtle)]" />;
}

function MenuItem({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex w-full items-center rounded px-2 py-1.5 text-left text-[13px] transition-colors",
        danger
          ? "text-[var(--tag-red-text)] hover:bg-[var(--tag-red-bg)]"
          : "text-[var(--fg-base)] hover:bg-[var(--bg-subtle-hover)]",
        disabled && "cursor-not-allowed opacity-40 hover:bg-transparent"
      )}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({
  value,
  onChange,
  ariaLabel = "Section content",
  className,
  headingLevels = [2, 3],
}: {
  value: string;
  onChange: (html: string) => void;
  ariaLabel?: string;
  className?: string;
  headingLevels?: (1 | 2 | 3 | 4 | 5 | 6)[];
}) {
  const onChangeRef = useRef(onChange);
  const lastHtml = useRef(value);
  const [openMenu, setOpenMenu] = useState<"heading" | "table" | null>(null);
  const headingMenuRef = useRef<HTMLDivElement>(null);
  const tableMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: headingLevels },
        link: { openOnClick: false, autolink: true, linkOnPaste: true },
      }),
      TableKit.configure({
        table: {
          resizable: false,
          lastColumnResizable: false,
          allowTableNodeSelection: true,
        },
      }),
    ],
    content: toEditorHtml(value),
    onUpdate: ({ editor: current }) => {
      const html = current.getHTML();
      lastHtml.current = html;
      onChangeRef.current(html);
    },
    editorProps: {
      attributes: {
        class: "focus:outline-none",
        "aria-label": ariaLabel,
      },
    },
  });

  useEffect(() => {
    if (value === lastHtml.current) return;
    lastHtml.current = value;
    editor.commands.setContent(toEditorHtml(value), { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    if (!openMenu) return;
    const activeRef = openMenu === "heading" ? headingMenuRef : tableMenuRef;
    const handlePointerDown = (event: MouseEvent) => {
      if (activeRef.current && !activeRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [openMenu]);

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      bulletList: current.isActive("bulletList"),
      orderedList: current.isActive("orderedList"),
      activeHeading: current.isActive("heading"),
      inTable: current.isActive("table"),
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  });

  const runCommand = (command: () => void) => {
    command();
    setOpenMenu(null);
  };

  return (
    <div
      className={cn(
        "rounded-md bg-[var(--bg-field)] shadow-[var(--borders-base)] transition-shadow focus-within:shadow-[var(--borders-interactive-with-active)]",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-0.5 border-b border-[var(--border-subtle)] px-1.5 py-1">
        <ToolbarButton
          label="Bold"
          active={state.bold}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={state.italic}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <div ref={headingMenuRef} className="relative">
          <button
            type="button"
            title="Text style"
            aria-label="Text style"
            aria-haspopup="menu"
            aria-expanded={openMenu === "heading"}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setOpenMenu(openMenu === "heading" ? null : "heading")}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded px-1.5 text-[13px] text-[var(--fg-subtle)] transition-colors hover:bg-[var(--bg-subtle-hover)] hover:text-[var(--fg-base)]",
              state.activeHeading && "text-[var(--fg-base)]"
            )}
          >
            <Heading className="h-3.5 w-3.5" />
            <ChevronDown className="h-3 w-3" />
          </button>

          {openMenu === "heading" && (
            <div
              role="menu"
              className="absolute left-0 top-full z-30 mt-1 w-40 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] p-1 shadow-[var(--elevation-flyout)]"
            >
              <MenuItem onClick={() => runCommand(() => editor.chain().focus().setParagraph().run())}>
                Paragraph
              </MenuItem>
              {headingLevels.map((level) => (
                <MenuItem
                  key={level}
                  onClick={() =>
                    runCommand(() => editor.chain().focus().toggleHeading({ level }).run())
                  }
                >
                  Heading {level}
                </MenuItem>
              ))}
            </div>
          )}
        </div>

        <Separator />

        <ToolbarButton
          label="Bullet list"
          active={state.bulletList}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          active={state.orderedList}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>

        <Separator />

        <div ref={tableMenuRef} className="relative">
          <button
            type="button"
            title="Table options"
            aria-label="Table options"
            aria-haspopup="menu"
            aria-expanded={openMenu === "table"}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setOpenMenu(openMenu === "table" ? null : "table")}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded px-1.5 text-[13px] text-[var(--fg-subtle)] transition-colors hover:bg-[var(--bg-subtle-hover)] hover:text-[var(--fg-base)]",
              state.inTable && "text-[var(--fg-base)]"
            )}
          >
            <Table2 className="h-3.5 w-3.5" />
            <span>Table</span>
            <ChevronDown className="h-3 w-3" />
          </button>

          {openMenu === "table" && (
            <div
              role="menu"
              className="absolute left-0 top-full z-30 mt-1 w-52 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] p-1 shadow-[var(--elevation-flyout)]"
            >
              <MenuItem
                onClick={() =>
                  runCommand(() =>
                    editor.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: false }).run()
                  )
                }
              >
                Insert 3 × 2 table
              </MenuItem>
              <MenuItem
                disabled={!state.inTable}
                onClick={() => runCommand(() => editor.chain().focus().addRowAfter().run())}
              >
                Add row below
              </MenuItem>
              <MenuItem
                disabled={!state.inTable}
                onClick={() => runCommand(() => editor.chain().focus().addColumnAfter().run())}
              >
                Add column to the right
              </MenuItem>
              <MenuItem
                disabled={!state.inTable}
                onClick={() => runCommand(() => editor.chain().focus().deleteRow().run())}
              >
                Delete row
              </MenuItem>
              <MenuItem
                disabled={!state.inTable}
                onClick={() => runCommand(() => editor.chain().focus().deleteColumn().run())}
              >
                Delete column
              </MenuItem>
              <MenuItem
                danger
                disabled={!state.inTable}
                onClick={() => runCommand(() => editor.chain().focus().deleteTable().run())}
              >
                Delete table
              </MenuItem>
            </div>
          )}
        </div>

        <Separator />

        <ToolbarButton
          label="Undo"
          disabled={!state.canUndo}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Redo"
          disabled={!state.canRedo}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>

      <EditorContent editor={editor} className="rte-editor" />
    </div>
  );
}
