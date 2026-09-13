import { type FormEvent } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import type { ProductTypeInfo, TypeCategory } from "../store/types";
import { Button, Input, Label, Modal } from "./ui";
import { UploadButton } from "./UploadButton";
import { SortableList, DragHandle } from "./SortableList";
import { slugify } from "./TypeFormModal";

type SubCategoryForm = {
  label: string;
  slug: string;
  tagline: string;
  heroImage: string;
};

const emptySubCategory: SubCategoryForm = {
  label: "",
  slug: "",
  tagline: "",
  heroImage: "",
};

function SubCategoryFormModal({
  open,
  onClose,
  subCategoryTarget,
  editingSubIndex,
  subForm,
  setSubForm,
  subSlugConflict,
  savingSub,
  onSubmit,
  onEditSubCategory,
  onSetSubDeleteIndex,
  onClearEdit,
  onReorder,
}: {
  open: boolean;
  onClose: () => void;
  subCategoryTarget: ProductTypeInfo | null;
  editingSubIndex: number | null;
  subForm: SubCategoryForm;
  setSubForm: (value: SubCategoryForm) => void;
  subSlugConflict: boolean;
  savingSub: boolean;
  onSubmit: (e: FormEvent) => void;
  onEditSubCategory: (index: number) => void;
  onSetSubDeleteIndex: (index: number) => void;
  onClearEdit: () => void;
  onReorder: (categories: TypeCategory[]) => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingSubIndex !== null ? "Edit Sub-category" : "Add Sub-category"}
      description={
        subCategoryTarget
          ? editingSubIndex !== null
            ? `Update "${subCategoryTarget.categories[editingSubIndex]?.label ?? ""}" in ${subCategoryTarget.label}.`
            : `Add a new sub-category to ${subCategoryTarget.label}.`
          : undefined
      }
      footer={
        <>
          <Button variant="secondary" size="small" type="button" onClick={onClose} disabled={savingSub}>
            Done
          </Button>            <Button
            variant="primary"
            size="small"
            type="submit"
            form="sub-category-form"
            disabled={subSlugConflict || savingSub}
          >
            {savingSub ? "Saving…" : editingSubIndex !== null ? "Save changes" : "Add sub-category"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {subCategoryTarget && subCategoryTarget.categories.length > 0 && (
          <div className="flex flex-col gap-2">
            <Label>Existing sub-categories</Label>
            <div className="flex flex-col gap-1.5">
              <SortableList
                items={subCategoryTarget.categories}
                onReorder={onReorder}
                keyExtractor={(c) => c.slug}
                renderItem={(c, index, dragHandleProps) => (
                  <div className="flex items-center justify-between gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <DragHandle handleProps={dragHandleProps} />
                      {c.heroImage && (
                        <img
                          src={c.heroImage}
                          alt=""
                          className="h-7 w-7 shrink-0 rounded object-cover bg-[var(--bg-base)]"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-[13px] text-[var(--fg-base)]">{c.label}</p>
                        <p className="truncate text-xs text-[var(--fg-muted)]">{c.slug}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button variant="ghost" size="small" onClick={() => onEditSubCategory(index)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="small" onClick={() => onSetSubDeleteIndex(index)}>
                        <Trash2 className="h-4 w-4 text-[var(--tag-red-text)]" />
                      </Button>
                    </div>
                  </div>
                )}
              />
            </div>
          </div>
        )}
        <form
          id="sub-category-form"
          onSubmit={onSubmit}
          className="flex flex-col gap-3 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3"
        >
          <div className="flex items-center justify-between">
            <Label>{editingSubIndex !== null ? "Edit sub-category" : "New sub-category"}</Label>
            {editingSubIndex !== null && (
              <Button
                variant="ghost"
                size="small"
                type="button"
                onClick={onClearEdit}
              >
                <X className="h-4 w-4" />
                Cancel edit
              </Button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sub-label">Label</Label>
            <Input
              id="sub-label"
              value={subForm.label}
              onChange={(e) => setSubForm({ ...subForm, label: e.target.value })}
              placeholder="e.g. Dining Tables"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sub-slug">Slug</Label>
            <Input
              id="sub-slug"
              value={subForm.slug}
              onChange={(e) => setSubForm({ ...subForm, slug: e.target.value })}
              placeholder={slugify(subForm.label) || "dining-tables"}
            />
            {subSlugConflict && (
              <p className="text-xs text-[var(--tag-red-text)]">
                This slug is already used by another sub-category in this category.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sub-tagline">Tagline</Label>
            <Input
              id="sub-tagline"
              value={subForm.tagline}
              onChange={(e) => setSubForm({ ...subForm, tagline: e.target.value })}
              placeholder="e.g. Crafted for comfort."
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Hero Image</Label>
            <div className="flex items-center gap-3">
              {subForm.heroImage ? (
                <img
                  src={subForm.heroImage}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded object-cover bg-[var(--bg-subtle)]"
                />
              ) : null}
              <UploadButton
                onUploaded={(url) => setSubForm({ ...subForm, heroImage: url })}
                label={subForm.heroImage ? "Replace" : "Upload"}
                preset="hero"
              />
              {subForm.heroImage && (
                <Button
                  variant="ghost"
                  size="small"
                  type="button"
                  onClick={() => setSubForm({ ...subForm, heroImage: "" })}
                >
                  <X className="h-4 w-4" />
                  Remove
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}

export { SubCategoryFormModal, emptySubCategory };
export type { SubCategoryForm };
