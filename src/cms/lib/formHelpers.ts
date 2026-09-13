import type { ProductTypeInfo } from "../store/types";

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export type FormState = {
  slug: string;
  label: string;
  route: string;
  tagline: string;
  heroImage: string;
};

export const emptyForm: FormState = {
  slug: "",
  label: "",
  route: "",
  tagline: "",
  heroImage: "",
};

export function toForm(t: ProductTypeInfo): FormState {
  return {
    slug: t.slug,
    label: t.label,
    route: t.route,
    tagline: t.tagline ?? "",
    heroImage: t.heroImage,
  };
}

export type SubCategoryForm = {
  label: string;
  slug: string;
  tagline: string;
  heroImage: string;
};

export const emptySubCategory: SubCategoryForm = {
  label: "",
  slug: "",
  tagline: "",
  heroImage: "",
};
