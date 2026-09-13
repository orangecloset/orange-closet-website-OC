import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "../components/toastContext";
import { useCms } from "../store/cmsContext";
import { api } from "../lib/api";
import type { ProductTypeInfo, TypeCategory } from "../store/types";
import { Button, ConfirmDialog, Container, Header } from "../components/ui";
import { DndContainer, SortableItems, DragHandle } from "../components/SortableList";
import { arrayMove } from "@dnd-kit/sortable";
import { TypeFormModal, slugify, emptyForm, toForm } from "../components/TypeFormModal";
import type { FormState } from "../components/TypeFormModal";
import { SubCategoryFormModal, emptySubCategory } from "../components/SubCategoryFormModal";
import type { SubCategoryForm } from "../components/SubCategoryFormModal";

export default function TypesPage() {
  const { types, addType, updateType, reorderTypes, deleteType, flushSaves } = useCms();
  const { showToast } = useToast();
  const [deleteProductCount, setDeleteProductCount] = useState(0);
  const [editing, setEditing] = useState<ProductTypeInfo | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [savingType, setSavingType] = useState(false);
  const [savingSub, setSavingSub] = useState(false);

  const [subCategoryTarget, setSubCategoryTarget] = useState<ProductTypeInfo | null>(null);
  const [subForm, setSubForm] = useState<SubCategoryForm>(emptySubCategory);
  const [editingSubIndex, setEditingSubIndex] = useState<number | null>(null);
  const [subDeleteIndex, setSubDeleteIndex] = useState<number | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setCreating(true);
  };

  const openEdit = (t: ProductTypeInfo) => {
    setEditing(t);
    setForm(toForm(t));
    setCreating(true);
  };

  const openAddSubCategory = (t: ProductTypeInfo) => {
    setSubCategoryTarget(t);
    setEditingSubIndex(null);
    setSubForm(emptySubCategory);
  };

  const openEditSubCategory = (index: number) => {
    if (!subCategoryTarget) return;
    const c = subCategoryTarget.categories[index];
    if (!c) return;
    setEditingSubIndex(index);
    setSubForm({ label: c.label, slug: c.slug, tagline: c.tagline ?? "", heroImage: c.heroImage ?? "" });
  };

  const closeSubCategoryModal = () => {
    setSubCategoryTarget(null);
    setEditingSubIndex(null);
    setSubForm(emptySubCategory);
    setSubDeleteIndex(null);
  };

  const handleSubCategorySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!subCategoryTarget) return;
    const label = subForm.label.trim();
    const slug = subForm.slug.trim() || slugify(subForm.label);
    if (!label && !slug) return;

    const categories = [...subCategoryTarget.categories];
    const entry: TypeCategory = { label: label || slug, slug, tagline: subForm.tagline.trim() || undefined, heroImage: subForm.heroImage.trim() || undefined };
    if (editingSubIndex !== null && categories[editingSubIndex]) {
      categories[editingSubIndex] = entry;
    } else {
      categories.push(entry);
    }
    setSavingSub(true);
    try {
      updateType(subCategoryTarget.slug, { categories });
      await flushSaves();
      showToast(editingSubIndex !== null ? "Sub-category updated." : "Sub-category added.");
      closeSubCategoryModal();
    } catch {
      showToast("Couldn't save the sub-category. Please try again.");
    } finally {
      setSavingSub(false);
    }
  };

  const removeSubCategory = async (index: number) => {
    if (!subCategoryTarget) return;
    const categories = subCategoryTarget.categories.filter((_, i) => i !== index);
    updateType(subCategoryTarget.slug, { categories });
    setSubCategoryTarget({ ...subCategoryTarget, categories });
    setSubDeleteIndex(null);
    try {
      await flushSaves();
      showToast("Sub-category deleted.");
    } catch {
      showToast("Deleted locally — couldn't reach the server. Click Save to retry.");
    }
  };

  const setField = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const slug = form.slug.trim() || slugify(form.label);
    const route = form.route.trim() || `/${slug}`;
    const payload = {
      slug,
      label: form.label.trim() || slug,
      route,
      tagline: form.tagline.trim(),
      heroImage: form.heroImage.trim(),
      categories: editing?.categories ?? [],
    };

    setSavingType(true);
    try {
      if (editing) {
        updateType(editing.slug, payload);
        await flushSaves();
        showToast("Category updated.");
      } else {
        addType(payload);
        await flushSaves();
        showToast("Category added.");
      }
      setCreating(false);
      setEditing(null);
      setForm(emptyForm);
    } catch {
      showToast("Couldn't save the category. Please try again.");
    } finally {
      setSavingType(false);
    }
  };

  const typeSlugTaken = useMemo(
    () =>
      Boolean(form.slug.trim() &&
      types.some((t) => t.slug === form.slug.trim() && t.slug !== editing?.slug)),
    [form.slug, types, editing]
  );

  useEffect(() => {
    if (!deleteTarget) return;
    let cancelled = false;
    api
      .listProductsPaged({ page: 1, limit: 1, type: deleteTarget })
      .then((res) => !cancelled && setDeleteProductCount(res.totalItems))
      .catch(() => !cancelled && setDeleteProductCount(0));
    return () => {
      cancelled = true;
    };
  }, [deleteTarget]);

  const subSlugConflict = useMemo(() => {
    if (!subCategoryTarget) return false;
    const slug = subForm.slug.trim() || slugify(subForm.label);
    if (!slug) return false;
    return subCategoryTarget.categories.some(
      (c, i) => c.slug === slug && i !== editingSubIndex
    );
  }, [subCategoryTarget, subForm, editingSubIndex]);

  const handleTypesReorder = async (next: ProductTypeInfo[]) => {
    reorderTypes(next);
    try {
      await flushSaves();
      showToast("Order saved.");
    } catch {
      showToast("Couldn't save the new order. Please try again.");
    }
  };

  const handleSubCategoryReorder = async (categories: TypeCategory[]) => {
    if (!subCategoryTarget) return;
    updateType(subCategoryTarget.slug, { categories });
    setSubCategoryTarget({ ...subCategoryTarget, categories });
    try {
      await flushSaves();
      showToast("Order saved.");
    } catch {
      showToast("Couldn't save the new order. Please try again.");
    }
  };

  const clearSubEdit = () => {
    setEditingSubIndex(null);
    setSubForm(emptySubCategory);
  };

  return (
    <div className="flex flex-col gap-y-3">
      <Header
        title="Categories"
        subtitle="Manage storefront product types."
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-[30px] w-36 shrink-0 items-center justify-center gap-x-1.5 rounded-md bg-[var(--button-inverted)] px-3 text-[13px] font-medium text-[var(--contrast-fg-primary)] shadow-[var(--buttons-inverted)] outline-none transition-colors hover:bg-[var(--button-inverted-hover)] active:bg-[var(--button-inverted-pressed)]"
          >
            <Plus className="h-4 w-4 shrink-0" />
            Add Category
          </button>
        }
      />

      <Container>
        <div className="overflow-x-auto">
          <div className="w-full min-w-[640px] text-left">
            <div className="flex border-b border-[var(--border-subtle)] text-xs text-[var(--fg-muted)]">
              <div className="w-10 px-6 py-2.5 font-medium"></div>
              <div className="flex-1 px-6 py-2.5 font-medium">Type</div>
              <div className="w-40 px-6 py-2.5 font-medium">Route</div>
              <div className="w-36 px-6 py-2.5 font-medium">Sub-categories</div>
              <div className="w-20 px-6 py-2.5 text-right font-medium">Actions</div>
            </div>
            <DndContainer
              onDragEnd={(activeId, overId) => {
                const oldIndex = types.findIndex((t) => t.slug === activeId);
                const newIndex = types.findIndex((t) => t.slug === overId);
                if (oldIndex === -1 || newIndex === -1) return;
                handleTypesReorder(arrayMove(types, oldIndex, newIndex));
              }}
            >
              <SortableItems
                items={types}
                keyExtractor={(t) => t.slug}
                renderItem={(t, _index, dragHandleProps) => (
                  <div className="flex border-b border-[var(--border-subtle)] transition-colors hover:bg-[var(--bg-subtle-hover)]">
                    <div className="w-10 px-6 py-3">
                      <DragHandle handleProps={dragHandleProps} />
                    </div>
                    <div className="flex flex-1 items-center gap-3 px-6 py-3">
                      <img
                        src={t.heroImage}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded object-cover bg-[var(--bg-subtle)]"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm text-[var(--fg-base)]">{t.label}</p>
                        <p className="truncate text-xs text-[var(--fg-muted)]">{t.slug}</p>
                      </div>
                    </div>
                    <div className="flex w-40 items-center px-6 py-3 text-sm text-[var(--fg-muted)]">{t.route}</div>
                    <div className="flex w-36 items-center px-6 py-3">
                      <button
                        type="button"
                        onClick={() => openAddSubCategory(t)}
                        className="rounded-md px-2 py-0.5 text-sm text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-subtle-hover)] hover:text-[var(--fg-base)]"
                      >
                        {t.categories.length}
                      </button>
                    </div>
                    <div className="flex w-20 items-center justify-end gap-1 px-6 py-3">
                      <Button
                        variant="ghost"
                        size="small"
                        onClick={() => openAddSubCategory(t)}
                        title="Add sub-category"
                        aria-label="Add sub-category"
                      >
                        <Plus className="h-4 w-4 text-[var(--tag-green-text)]" />
                      </Button>
                      <Button variant="ghost" size="small" onClick={() => openEdit(t)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(t.slug)}
                        title="Delete"
                        aria-label="Delete category"
                        className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-sm outline-none transition-colors hover:bg-[var(--bg-subtle-hover)] focus-visible:shadow-[var(--borders-focus)]"
                      >
                        <Trash2
                          className="h-4 w-4 shrink-0 text-[var(--tag-red-text)]"
                        />
                      </button>
                    </div>
                  </div>
                )}
              />
            </DndContainer>
            {types.length === 0 && (
              <div className="px-6 py-12 text-center text-sm text-[var(--fg-muted)]">
                No categories yet. Click "Add Category" to create one.
              </div>
            )}
          </div>
        </div>
      </Container>

      <TypeFormModal
        open={creating}
        onClose={() => setCreating(false)}
        editing={editing}
        form={form}
        setField={setField}
        typeSlugTaken={typeSlugTaken}
        savingType={savingType}
        onSubmit={handleSubmit}
      />

      <SubCategoryFormModal
        open={subCategoryTarget !== null}
        onClose={closeSubCategoryModal}
        subCategoryTarget={subCategoryTarget}
        editingSubIndex={editingSubIndex}
        subForm={subForm}
        setSubForm={setSubForm}
        subSlugConflict={subSlugConflict}
        savingSub={savingSub}
        onSubmit={handleSubCategorySubmit}
        onEditSubCategory={openEditSubCategory}
        onSetSubDeleteIndex={setSubDeleteIndex}
        onClearEdit={clearSubEdit}
        onReorder={handleSubCategoryReorder}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteType(deleteTarget);
            showToast("Category deleted.");
          }
        }}
        title="Delete category"
        description={
          deleteTarget
            ? `${
                deleteProductCount > 0
                  ? `${deleteProductCount} product(s) in this category will also be permanently deleted. `
                  : ""
              }This removes the category from the CMS. This cannot be undone.`
            : "This removes the category from the CMS. This cannot be undone."
        }
        confirmLabel="Delete"
        confirmKeyword={types.find((t) => t.slug === deleteTarget)?.label ?? undefined}
      />

      <ConfirmDialog
        open={subDeleteIndex !== null}
        onClose={() => setSubDeleteIndex(null)}
        onConfirm={() => {
          if (subDeleteIndex !== null) removeSubCategory(subDeleteIndex);
        }}
        title="Delete sub-category"
        description={
          subDeleteIndex !== null && subCategoryTarget
            ? `Remove "${subCategoryTarget.categories[subDeleteIndex]?.label ?? "this sub-category"}" from ${subCategoryTarget.label}? This cannot be undone.`
            : "This removes the sub-category. This cannot be undone."
        }
        confirmLabel="Delete"
      />
    </div>
  );
}
