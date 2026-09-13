import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type CSSProperties,
  type ReactNode,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type SelectHTMLAttributes,
} from "react";
import { Link } from "react-router-dom";
import { createPortal } from "react-dom";
import { CheckCircle2, EllipsisVertical, Eye, EyeOff, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";
import { useFocusTrap } from "../lib/useFocusTrap";
import { ToastContext, type ToastType } from "./toastContext";

type ToastItem = { id: number; message: string; sticky?: boolean; type?: ToastType };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const showToast = useCallback((message: string, sticky?: boolean, type?: ToastType) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev.filter((t) => !t.sticky), { id, message, sticky, type }]);
    if (!sticky) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3000);
    }
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[200] flex flex-col gap-2">
        {toasts.map((t) => {
          const isError = t.type === "error";
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-center gap-2.5 rounded-md border bg-white px-4 py-2.5 shadow-[var(--elevation-flyout)] ${
                isError
                  ? "border-[var(--tag-red-border)]"
                  : t.type === "warning"
                  ? "border-[var(--tag-orange-border)]"
                  : "border-[var(--tag-green-border)]"
              }`}
            >
              <CheckCircle2
                className={`h-4 w-4 shrink-0 ${
                  isError
                    ? "text-[var(--tag-red-text)]"
                    : t.type === "warning"
                    ? "text-[var(--tag-orange-text)]"
                    : "text-[var(--tag-green-text)]"
                }`}
              />
              <span className="text-sm text-[var(--fg-base)]">{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function Checkbox({
  checked,
  onChange,
  disabled,
  label,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex items-center gap-2 text-[13px] text-[var(--fg-base)]",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="h-4 w-4 rounded border-[var(--border-base)] bg-[var(--bg-field)] text-[var(--bg-interactive)] accent-[var(--bg-interactive)]"
      />
      {label}
    </label>
  );
}

type TabItem = {
  key: string;
  label: string;
  count?: number;
};

export function Tabs({
  items,
  active,
  onChange,
}: {
  items: TabItem[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex gap-0 border-b border-[var(--border-subtle)]">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          className={cn(
            "relative px-4 py-2.5 text-[13px] font-medium transition-colors",
            active === item.key
              ? "text-[var(--fg-base)]"
              : "text-[var(--fg-muted)] hover:text-[var(--fg-base)]"
          )}
        >
          <span className="flex items-center gap-1.5">
            {item.label}
            {item.count !== undefined && (
              <span
                className={cn(
                  "inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[11px] font-medium",
                  active === item.key
                    ? "bg-[var(--bg-interactive)] text-[var(--fg-on-color)]"
                    : "bg-[var(--bg-subtle)] text-[var(--fg-muted)]"
                )}
              >
                {item.count}
              </span>
            )}
          </span>
          {active === item.key && (
            <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--bg-interactive)]" />
          )}
        </button>
      ))}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "transparent";
type ButtonSize = "small" | "base" | "large";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--button-inverted)] text-[var(--contrast-fg-primary)] shadow-[var(--buttons-inverted)] hover:bg-[var(--button-inverted-hover)] active:bg-[var(--button-inverted-pressed)]",
  secondary:
    "bg-[var(--button-neutral)] text-[var(--fg-base)] shadow-[var(--buttons-neutral)] hover:bg-[var(--button-neutral-hover)] active:bg-[var(--button-neutral-pressed)]",
  danger:
    "bg-[var(--button-danger)] text-[var(--fg-on-color)] shadow-[var(--buttons-danger)] hover:bg-[var(--button-danger-hover)] active:bg-[var(--button-danger-pressed)]",
  ghost: "text-[var(--fg-subtle)] hover:bg-[var(--bg-subtle-hover)] hover:text-[var(--fg-base)]",
  transparent:
    "bg-[var(--button-transparent)] text-[var(--fg-subtle)] hover:bg-[var(--button-transparent-hover)] hover:text-[var(--fg-base)]",
};

const buttonSizes: Record<ButtonSize, string> = {
  small: "px-2 py-1 text-[13px]",
  base: "px-3 py-1.5 text-[13px]",
  large: "px-4 py-2.5 text-sm",
};

export function Button({
  variant = "secondary",
  size = "base",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "relative inline-flex w-fit shrink-0 items-center justify-center gap-x-1.5 overflow-hidden whitespace-nowrap rounded-md font-medium outline-none transition-colors disabled:cursor-not-allowed disabled:border-[var(--border-base)] disabled:bg-[var(--bg-disabled)] disabled:text-[var(--fg-disabled)] disabled:shadow-[var(--buttons-neutral)]",
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
      {...props}
    />
  );
}

export type BadgeColor = "grey" | "green" | "red" | "blue" | "orange";
export type BadgeSize = "2xsmall" | "xsmall" | "small" | "base" | "large";

const badgeColors: Record<BadgeColor, string> = {
  grey: "bg-[var(--tag-neutral-bg)] text-[var(--tag-neutral-text)] border-[var(--tag-neutral-border)]",
  green: "bg-[var(--tag-green-bg)] text-[var(--tag-green-text)] border-[var(--tag-green-border)]",
  red: "bg-[var(--tag-red-bg)] text-[var(--tag-red-text)] border-[var(--tag-red-border)]",
  blue: "bg-[var(--tag-blue-bg)] text-[var(--tag-blue-text)] border-[var(--tag-blue-border)]",
  orange: "bg-[var(--tag-orange-bg)] text-[var(--tag-orange-text)] border-[var(--tag-orange-border)]",
};

const badgeSizes: Record<BadgeSize, string> = {
  "2xsmall": "h-5 w-16 px-1 text-[12px]",
  xsmall: "h-6 w-[88px] px-1 text-[12px]",
  small: "h-7 w-24 px-2 text-[12px]",
  base: "h-8 w-28 px-3 text-[12px]",
  large: "h-10 w-32 px-4 text-[13px]",
};

export function Badge({
  color = "grey",
  size = "xsmall",
  children,
  className,
}: {
  color?: BadgeColor;
  size?: BadgeSize;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center gap-x-0.5 whitespace-nowrap rounded-md border font-medium text-center",
        badgeColors[color],
        badgeSizes[size],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Pagination({
  page,
  pageCount,
  pageSize,
  totalItems,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  const start = totalItems === 0 ? 0 : page * pageSize + 1;
  const end = Math.min((page + 1) * pageSize, totalItems);
  const chevronClass =
    "flex h-7 w-7 items-center justify-center rounded-md text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-subtle-hover)] hover:text-[var(--fg-base)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";
  return (
    <div className="flex items-center justify-end gap-1 border-t border-[var(--border-subtle)] px-6 py-3">
      <button
        type="button"
        aria-label="Previous page"
        disabled={page === 0}
        onClick={() => onPageChange(page - 1)}
        className={chevronClass}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="px-1 text-xs text-[var(--fg-muted)]">
        {start} – {end} of {totalItems}
      </span>
      <button
        type="button"
        aria-label="Next page"
        disabled={page >= pageCount - 1}
        onClick={() => onPageChange(page + 1)}
        className={chevronClass}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full overflow-x-auto divide-y divide-[var(--border-subtle)] rounded-lg bg-[var(--bg-base)] p-0 shadow-[var(--elevation-card-rest)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Header({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-6 py-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="text-base font-medium text-[var(--fg-base)]">{title}</h2>
        {subtitle && (
          <p className="hidden text-sm text-[var(--fg-subtle)] sm:block">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Label({
  children,
  htmlFor,
}: {
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-[var(--fg-base)]">
      {children}
    </label>
  );
}

const fieldBase =
  "relative w-full appearance-none rounded-md bg-[var(--bg-field)] text-[13px] text-[var(--fg-base)] shadow-[var(--borders-base)] outline-none transition-colors placeholder:text-[var(--fg-muted)] hover:bg-[var(--bg-field-hover)] focus-visible:shadow-[var(--borders-interactive-with-active)] disabled:cursor-not-allowed disabled:bg-[var(--bg-disabled)] disabled:text-[var(--fg-disabled)] disabled:placeholder:text-[var(--fg-disabled)]";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn("h-8 px-2 py-1.5", fieldBase, className)}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn("min-h-[80px] max-h-[200px] px-2 py-1.5", fieldBase, className)}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn("h-8 px-2 py-1.5", fieldBase, className)}
      {...props}
    >
      {children}
    </select>
  );
}

export function Switch({
  checked,
  onCheckedChange,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-[18px] w-[32px] shrink-0 items-center rounded-full outline-none transition-colors focus-visible:shadow-[var(--borders-focus)] disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-[var(--bg-interactive)]" : "bg-[var(--bg-switch-off)] hover:bg-[var(--bg-switch-off-hover)]"
      )}
    >
      <span
        className={cn(
          "pointer-events-none h-[14px] w-[14px] rounded-full bg-[var(--fg-on-color)] shadow-[var(--details-switch-handle)] transition-transform",
          checked ? "translate-x-[16px]" : "translate-x-[2px]"
        )}
      />
    </button>
  );
}

export type ActionItem = {
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  onClick?: () => void;
  to?: string;
};

export function ActionMenu({ items }: { items: ActionItem[] }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const MENU_WIDTH = 160;

  const updatePosition = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const menuHeight = items.length * 34 + 8;
    const left = Math.max(
      8,
      Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)
    );
    const top =
      rect.bottom + menuHeight > window.innerHeight - 8
        ? Math.max(8, rect.top - menuHeight - 4)
        : rect.bottom + 4;
    setPos({ top, left });
  }, [items.length]);

  const toggle = () => {
    if (!open) {
      updatePosition();
      setPortalTarget(
        ref.current?.closest(".cms-admin") as HTMLElement ?? document.body
      );
    }
    setOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        ref.current &&
        !ref.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      )
        setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const handleReposition = () => updatePosition();
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    document.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [open, updatePosition]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        aria-label="Actions"
        className="flex h-fit w-fit items-center justify-center rounded-sm p-1 text-[var(--fg-muted)] outline-none transition-colors hover:bg-[var(--bg-subtle-hover)] hover:text-[var(--fg-base)] focus-visible:shadow-[var(--borders-focus)]"
      >
        <EllipsisVertical className="h-4 w-4" />
      </button>
      {open &&
        portalTarget &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[60] min-w-[160px] rounded-lg bg-[var(--bg-base)] p-1 shadow-[var(--elevation-flyout)]"
            style={{ top: `${pos.top}px`, left: `${pos.left}px` }}
          >
            {items.map((item, index) => {
              const content = (
                <>
                  {item.icon}
                  <span>{item.label}</span>
                </>
              );
              const className = cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors",
                item.danger
                  ? "text-[var(--tag-red-text)] hover:bg-[var(--tag-red-bg)]"
                  : "text-[var(--fg-base)] hover:bg-[var(--bg-subtle-hover)]"
              );
              return (
                <div key={index}>
                  {item.to ? (
                    <Link
                      to={item.to}
                      className={className}
                      onClick={() => setOpen(false)}
                    >
                      {content}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className={className}
                      onClick={() => {
                        setOpen(false);
                        item.onClick?.();
                      }}
                    >
                      {content}
                    </button>
                  )}
                </div>
              );
            })}
          </div>,
          portalTarget
        )}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[var(--bg-overlay)]" onClick={onClose} aria-hidden />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-xl bg-[var(--bg-base)] shadow-[var(--elevation-modal)] outline-none"
      >
        <div className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--bg-base)] px-6 py-4">
          <h3 className="text-lg font-medium text-[var(--fg-base)]">{title}</h3>
          {description && <p className="mt-1 text-sm text-[var(--fg-subtle)]">{description}</p>}
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--border-subtle)] bg-[var(--bg-base)] px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Delete",
  confirmKeyword,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmKeyword?: string;
}) {
  const [keyword, setKeyword] = useState("");
  useEffect(() => {
    if (!open) setKeyword("");
  }, [open]);
  const confirmed = !confirmKeyword || keyword === confirmKeyword;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" size="small" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="small"
            disabled={!confirmed}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {confirmKeyword && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm-keyword-input">
            Type <span className="font-semibold">{confirmKeyword}</span> to confirm
          </Label>
          <Input
            id="confirm-keyword-input"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={confirmKeyword}
            autoComplete="off"
          />
        </div>
      )}
    </Modal>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-lg bg-[var(--bg-base)] px-6 py-4 shadow-[var(--elevation-card-rest)]">
      <p className="text-[13px] text-[var(--fg-muted)]">{label}</p>
      <p className="mt-1 text-lg font-medium text-[var(--fg-base)]">{value}</p>
      {hint && <p className="mt-1 text-xs text-[var(--fg-disabled)]">{hint}</p>}
    </div>
  );
}

export function PasswordInput({
  className,
  style,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        type="text"
        autoComplete="one-time-code"
        className={cn("pr-8", className)}
        style={{ WebkitTextSecurity: visible ? "none" : "disc", ...style } as CSSProperties}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((prev) => !prev)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center border-l border-[var(--border-base)] text-[var(--fg-muted)] outline-none transition-colors hover:text-[var(--fg-base)] focus-visible:shadow-[var(--borders-focus)]"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
