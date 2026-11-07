import { useEffect, useMemo, useState } from "react";
import type { CmsProduct } from "../../data/store-types";
import { productColorCss } from "../../data/products";
import { apiErrorMessage, type StockAdjustmentChange } from "../lib/api";
import { useCms } from "../store/cmsContext";
import { useToast } from "../store/toastContext";
import { Button, Input, Modal, Select } from "./ui";

const STOCK_REASONS = ["New Arrival", "Restock", "Correction", "Others"] as const;

const MAX_STOCK = 500_000;

function parseStockValue(raw: string | undefined): number {
  const trimmed = (raw ?? "").trim();
  const parsed = Number(trimmed);
  return trimmed === "" || !Number.isFinite(parsed)
    ? 0
    : Math.min(MAX_STOCK, Math.max(0, Math.floor(parsed)));
}

function buildStockValues(product: CmsProduct): Record<string, string> {
  const values: Record<string, string> = {};
  product.colors.forEach((color) => {
    (color.sizes ?? []).forEach((variant) => {
      const key = `${color.name}::${variant.size}`;
      const stock = Number(variant.stock);
      values[key] =
        Number.isFinite(stock) && stock !== 0 ? String(stock) : "";
    });
  });
  return values;
}

export function StockAdjustModal({
  product,
  open,
  onClose,
  onSaved,
}: {
  product: CmsProduct | null;
  open: boolean;
  onClose: () => void;
  onSaved?: (product: CmsProduct | null) => void;
}) {
  const { adjustStock } = useCms();
  const { showToast } = useToast();
  const [stockValues, setStockValues] = useState<Record<string, string>>({});
  const [initialValues, setInitialValues] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [reasonNote, setReasonNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !product) return;
    const values = buildStockValues(product);
    setStockValues(values);
    setInitialValues(values);
    setReason("");
    setReasonNote("");
  }, [open, product]);

  const changes = useMemo(() => {
    if (!product) return [] as StockAdjustmentChange[];
    const keys = new Set([...Object.keys(initialValues), ...Object.keys(stockValues)]);
    const next: StockAdjustmentChange[] = [];
    for (const key of keys) {
      const prev = parseStockValue(initialValues[key]);
      const value = parseStockValue(stockValues[key]);
      if (prev === value) continue;
      const [colorName, size] = key.split("::");
      next.push({ colorName, size, newStock: value });
    }
    return next;
  }, [initialValues, stockValues, product]);

  const stocksChanged = changes.length > 0;
  const stockReasonValid =
    !stocksChanged ||
    (reason !== "" && (reason !== "Others" || reasonNote.trim().length > 0));
  const reasonMissing = stocksChanged && !reason;
  const noteMissing = stocksChanged && reason === "Others" && !reasonNote.trim();

  const save = async () => {
    if (!product || !stockReasonValid || !stocksChanged) return;
    setSaving(true);
    try {
      const reasonText = reason === "Others" ? reasonNote.trim() : reason;
      const updated = await adjustStock(product.id, {
        reason: reasonText,
        changes,
      });
      showToast("Stock updated.");
      onSaved?.(updated);
      onClose();
    } catch (err) {
      console.error("[cms] failed to adjust stock", err);
      showToast(
        apiErrorMessage(err, "Couldn't update the stock. Please try again."),
        false,
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!saving) onClose();
      }}
      title="Adjust Stock"
      description={product ? `${product.name} — per color stock` : undefined}
      footer={
        <>
          <Button
            variant="secondary"
            size="small"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="small"
            onClick={save}
            disabled={saving || !stockReasonValid || !stocksChanged}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      {product && (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-[var(--fg-muted)]">
            Stock changes are recorded in Inventory with the reason below.
            Product edits never change stock.
          </p>

          {product.colors.map((color) => {
            const sizes = color.sizes ?? [];
            const total = sizes.reduce(
              (sum, variant) => sum + (Number(variant.stock) || 0),
              0
            );
            return (
              <div
                key={color.name}
                className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3"
              >
                <div className="mb-2 flex items-center gap-3">
                  <span
                    className="h-5 w-5 shrink-0 rounded-full border border-[var(--border-base)]"
                    style={{ background: productColorCss(color) }}
                  />
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--fg-base)]">
                    {color.name}
                  </p>
                  <span className="text-xs text-[var(--fg-muted)]">
                    {total <= 0 ? "Sold out" : `${total} in stock`}
                  </span>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] items-center gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
                  {sizes.map((variant) => {
                    const key = `${color.name}::${variant.size}`;
                    return (
                      <div key={variant.size} className="contents">
                        <p className="truncate text-sm text-[var(--fg-base)]">
                          {variant.size}
                        </p>
                        <Input
                          type="number"
                          min={0}
                          max={MAX_STOCK}
                          aria-label={`${color.name} ${variant.size} stock`}
                          value={stockValues[key] ?? ""}
                          onChange={(e) =>
                            setStockValues((prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                          placeholder="0"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3">
            <label
              htmlFor="stock-adjust-reason"
              className="mb-1.5 block text-sm font-medium text-[var(--fg-base)]"
            >
              Reason{" "}
              <span className="text-[var(--fg-muted)]">
                (required when stock changes)
              </span>
            </label>
            <Select
              id="stock-adjust-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={
                reasonMissing
                  ? "shadow-[0_0_0_1px_var(--fg-error),0_1px_2px_0_rgba(0,0,0,0.12)]"
                  : undefined
              }
            >
              <option value="">Select a reason…</option>
              {STOCK_REASONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
            {reason === "Others" && (
              <div className="mt-2">
                <Input
                  value={reasonNote}
                  onChange={(e) => setReasonNote(e.target.value)}
                  placeholder="Type the reason…"
                  maxLength={200}
                  className={
                    noteMissing
                      ? "shadow-[0_0_0_1px_var(--fg-error),0_1px_2px_0_rgba(0,0,0,0.12)]"
                      : undefined
                  }
                />
              </div>
            )}
          </div>

          <p className="text-xs text-[var(--fg-muted)]">
            Sales deduct automatically on the Sell page.
          </p>
        </div>
      )}
    </Modal>
  );
}
