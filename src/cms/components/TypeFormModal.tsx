import { type FormEvent } from "react";
import { X } from "lucide-react";
import type { ProductTypeInfo } from "../store/types";
import { Button, Input, Label, Modal } from "./ui";
import { UploadButton } from "./UploadButton";
import { slugify, type FormState } from "../lib/formHelpers";

function TypeFormModal({
  open,
  onClose,
  editing,
  form,
  setField,
  typeSlugTaken,
  savingType,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  editing: ProductTypeInfo | null;
  form: FormState;
  setField: (patch: Partial<FormState>) => void;
  typeSlugTaken: boolean;
  savingType: boolean;
  onSubmit: (e: FormEvent) => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit Category" : "Add Category"}
      description={
        editing
          ? "Update this product type."
          : "New product types are saved to the CMS. They can be connected to the storefront later."
      }
      footer={
        <>
          <Button variant="secondary" size="small" type="button" onClick={onClose} disabled={savingType}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="small"
            type="submit"
            form="type-form"
            disabled={Boolean(typeSlugTaken) || savingType}
          >
            {savingType ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <form id="type-form" onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="type-label">Label</Label>
          <Input
            id="type-label"
            value={form.label}
            onChange={(e) => setField({ label: e.target.value })}
            placeholder="e.g. Tables"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="type-slug">Slug</Label>
          <Input
            id="type-slug"
            value={form.slug}
            onChange={(e) => setField({ slug: e.target.value })}
            placeholder={slugify(form.label) || "tables"}
          />
          {typeSlugTaken && (
            <p className="text-xs text-[var(--tag-red-text)]">
              This slug is already used by another category.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="type-route">Route</Label>
          <Input
            id="type-route"
            value={form.route}
            onChange={(e) => setField({ route: e.target.value })}
            placeholder={`/${slugify(form.label) || "tables"}`}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="type-tagline">Tagline</Label>
          <Input
            id="type-tagline"
            value={form.tagline}
            onChange={(e) => setField({ tagline: e.target.value })}
            placeholder="e.g. Designed to last."
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Hero Image</Label>
          <div className="flex items-center gap-3">
            {form.heroImage ? (
              <img
                src={form.heroImage}
                alt=""
                className="h-12 w-12 shrink-0 rounded object-cover bg-[var(--bg-subtle)]"
              />
            ) : null}
            <UploadButton
              onUploaded={(url) => setField({ heroImage: url })}
              label={form.heroImage ? "Replace" : "Upload"}
              preset="hero"
            />
            {form.heroImage && (
              <Button
                variant="ghost"
                size="small"
                type="button"
                onClick={() => setField({ heroImage: "" })}
              >
                <X className="h-4 w-4" />
                Remove
              </Button>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
}

export { TypeFormModal };
