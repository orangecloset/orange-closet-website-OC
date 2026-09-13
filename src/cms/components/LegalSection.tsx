import { Plus, Pencil, X } from "lucide-react";
import { Link } from "react-router-dom";
import type { FooterLink } from "../store/types";
import { Button } from "../components/ui";
import { SortableList, DragHandle } from "../components/SortableList";

function deriveSlug(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function LegalSection({
  links,
  onChange,
}: {
  links: FooterLink[];
  onChange: (next: FooterLink[]) => void;
}) {
  const add = () => onChange([...links, { label: "", url: "", body: "" }]);

  return (
    <div className="flex flex-col gap-3 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-[var(--fg-base)]">Legal</h3>
          <p className="text-xs text-[var(--fg-muted)]">Markdown pages shown at /legal/your-page</p>
        </div>
        <Button variant="secondary" size="small" type="button" onClick={add}>
          <Plus className="h-4 w-4" />
          Add Page
        </Button>
      </div>
      {links.length === 0 && <p className="text-sm text-[var(--fg-muted)]">No legal pages yet.</p>}
      <div className="flex flex-col gap-2">
        <SortableList
          items={links}
          onReorder={onChange}
          keyExtractor={(_link, index) => String(index)}
          renderItem={(link, index, dragHandleProps) => {
            const slug = deriveSlug(link.label);
            return (
              <div className="flex items-center gap-2">
                <DragHandle handleProps={dragHandleProps} />
                <input
                  value={link.label}
                  onChange={(e) => onChange(links.map((l, i) => i === index ? { ...l, label: e.target.value } : l))}
                  placeholder="Page title"
                  className="flex-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 py-1 text-sm"
                />
                {slug && (
                  <Link to={`/cms-admin/legal/${slug}/edit`}>
                    <Button variant="ghost" size="small" type="button">
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                  </Link>
                )}
                <Button variant="ghost" size="small" type="button" onClick={() => onChange(links.filter((_, i) => i !== index))} aria-label="Remove">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}
