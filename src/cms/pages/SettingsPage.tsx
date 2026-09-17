import { useState, type FormEvent } from "react";
import { Plus, X, Ban, Copy, Check, Eye, EyeOff, Trash2, TriangleAlert, Facebook, Instagram, Youtube, Twitter } from "lucide-react";
import { useCms } from "../store/cmsContext";
import { authHeaders } from "../store/auth";
import type { FooterLink } from "../store/types";
import {
  ActionMenu,
  Badge,
  Button,
  ConfirmDialog,
  Container,
  Header,
  Input,
  Label,
  Switch,
} from "../components/ui";
import { useToast } from "../store/toastContext";
import { UploadButton } from "../components/UploadButton";
import { formatDateTime } from "../lib/utils";
import { SortableList, DragHandle } from "../components/SortableList";
import { LegalSection } from "../components/LegalSection";

function LinkSection({
  title,
  subtitle,
  links,
  onChange,
  placeholder = "https://...",
}: {
  title: string;
  subtitle: string;
  links: FooterLink[];
  onChange: (next: FooterLink[]) => void;
  placeholder?: string;
}) {
  const add = () => onChange([...links, { label: "", url: "" }]);
  return (
    <div className="flex flex-col gap-3 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-[var(--fg-base)]">{title}</h3>
          <p className="text-xs text-[var(--fg-muted)]">{subtitle}</p>
        </div>
        <Button variant="secondary" size="small" type="button" onClick={add}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>
      {links.length === 0 && <p className="text-sm text-[var(--fg-muted)]">No links yet.</p>}
      <div className="flex flex-col gap-2">
        <SortableList
          items={links}
          onReorder={onChange}
          keyExtractor={(link, index) => `${link.label}-${link.url}-${index}`}
          renderItem={(link, index, dragHandleProps) => (
            <div className="flex items-center gap-2">
              <DragHandle handleProps={dragHandleProps} />
              <Input
                value={link.label}
                onChange={(e) => onChange(links.map((l, i) => i === index ? { ...l, label: e.target.value } : l))}
                placeholder="Label"
                className="flex-1"
              />
              <Input
                value={link.url}
                onChange={(e) => onChange(links.map((l, i) => i === index ? { ...l, url: e.target.value } : l))}
                placeholder={placeholder}
                className="flex-1"
              />
              <Button variant="ghost" size="small" type="button" onClick={() => onChange(links.filter((_, i) => i !== index))} aria-label="Remove">
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        />
      </div>
    </div>
  );
}

const SOCIAL_PLATFORMS = [
  { label: "Facebook", Icon: Facebook },
  { label: "Instagram", Icon: Instagram },
  { label: "YouTube", Icon: Youtube },
  { label: "Twitter", Icon: Twitter },
];

export default function SettingsPage() {
  const { settings, configDirty, updateSettings, flushSaves, links, createCatalogLink, revokeCatalogLink, deleteCatalogLink } = useCms();
  const { showToast } = useToast();

  const set = (patch: Partial<typeof settings>) => updateSettings(patch);

  const [copied, setCopied] = useState<string | null>(null);
  const [pinVisibleId, setPinVisibleId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  const handleCloudinaryCleanup = async () => {
    setCleaning(true);
    try {
      const res = await fetch("/api/cron/cloudinary-gc", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; deletedCount?: number }
        | null;
      if (!res.ok || !data?.ok) throw new Error(String(res.status));
      showToast(
        data.deletedCount === 0
          ? "All clean — no unused images found."
          : `Cleanup done — ${data.deletedCount} unused image(s) deleted.`
      );
    } catch {
      showToast("Couldn't run the cleanup. Please try again.");
    } finally {
      setCleaning(false);
    }
  };

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      void 0;
    }
  };

  const hasUnsafeUrl = (url: string | undefined | null): boolean => {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      return parsed.protocol === "javascript:";
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const urlFields = [
      settings.faviconUrl,
      settings.ogImageUrl,
      settings.facebookUrl,
      settings.messengerUrl,
      ...settings.aboutLinks.map((l) => l.url),
      ...settings.branchLinks.map((l) => l.url),
      ...settings.socials.map((s) => s.url),
    ];
    if (urlFields.some(hasUnsafeUrl)) {
      showToast("URLs starting with javascript: are not allowed.");
      return;
    }
    setSaving(true);
    try {
      await flushSaves();
      showToast("Settings saved.");
    } catch {
      showToast("Couldn't save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-y-3">
        <Header
          title="Settings"
          subtitle="Store identity and footer content shown on the storefront. Changes apply when you click Save."
          actions={
            <Button
              variant="primary"
              size="small"
              type="submit"
              form="settings-form"
              disabled={saving || !configDirty.includes("orange-cms-settings")}
            >
              {saving ? "Saving…" : configDirty.includes("orange-cms-settings") ? "Save changes" : "Save"}
            </Button>
          }
        />

      <form id="settings-form" onSubmit={handleSubmit} className="flex flex-col gap-y-3">
        <Container>
          <Header title="Store Identity" subtitle="Brand name and tagline" />
          <div className="grid grid-cols-1 gap-4 px-6 py-4 lg:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="store-name">Store Name</Label>
              <Input
                id="store-name"
                value={settings.storeName}
                onChange={(e) => set({ storeName: e.target.value })}
                placeholder="ORANGE CLOSET"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="tagline">Tagline</Label>
              <Input
                id="tagline"
                value={settings.tagline}
                onChange={(e) => set({ tagline: e.target.value })}
                placeholder="Fashion that fits every day"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Favicon</Label>
              <div className="flex items-center gap-2">
                <img
                  src={settings.faviconUrl}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded object-contain bg-[var(--bg-subtle)]"
                />
                <UploadButton
                  onUploaded={(url) => set({ faviconUrl: url })}
                  label="Upload"
                  preset="raw"
                />
                {settings.faviconUrl.trim() !== "/favicon.png" && (
                  <Button
                    variant="ghost"
                    size="small"
                    type="button"
                    onClick={() => set({ faviconUrl: "/favicon.png" })}
                  >
                    Use default
                  </Button>
                )}
              </div>
              <p className="text-xs text-[var(--fg-muted)]">
                Square image, 64×64 px or larger (.png, .ico, or .svg).
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Social Share Image</Label>
              <div className="flex items-center gap-2">
                {settings.ogImageUrl ? (
                  <img
                    src={settings.ogImageUrl}
                    alt=""
                    className="h-10 w-16 shrink-0 rounded object-cover bg-[var(--bg-subtle)]"
                  />
                ) : (
                  <div className="h-10 w-16 shrink-0 rounded bg-[var(--bg-subtle)]" />
                )}
                <UploadButton
                  onUploaded={(url) => set({ ogImageUrl: url })}
                  label="Upload"
                  preset="raw"
                />
                {settings.ogImageUrl.trim() !== "/og-image.jpg" && (
                  <Button
                    variant="ghost"
                    size="small"
                    type="button"
                    onClick={() => set({ ogImageUrl: "/og-image.jpg" })}
                  >
                    Use default
                  </Button>
                )}
              </div>
              <p className="text-xs text-[var(--fg-muted)]">
                Shown when the site link is shared on social media. Landscape
                image, 1200×630 px (.jpg or .png).
              </p>
            </div>
          </div>
        </Container>

        <Container>
          <Header title="Storefront Behavior" subtitle="Toggles that control what appears on the storefront" />
          <div className="flex flex-col gap-4 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Share button</Label>
                <p className="text-xs text-[var(--fg-muted)]">
                  Show the share button on the storefront navbar
                </p>
              </div>
              <Switch
                checked={settings.showShareButton}
                onCheckedChange={(value) => set({ showShareButton: value })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Show stock on storefront</Label>
                <p className="text-xs text-[var(--fg-muted)]">
                  Display stock numbers on product pages and size selectors
                </p>
              </div>
              <Switch
                checked={settings.showStockOnStorefront}
                onCheckedChange={(value) => set({ showStockOnStorefront: value })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="new-arrival-days">New Arrival Duration</Label>
                <p className="text-xs text-[var(--fg-muted)]">
                  How many days a product shows the "New" badge after being added
                </p>
              </div>
              <Input
                id="new-arrival-days"
                type="number"
                min={1}
                value={settings.newArrivalDays}
                onChange={(e) =>
                  set({ newArrivalDays: Math.max(1, Number(e.target.value) || 1) })
                }
                className="w-24"
              />
            </div>
          </div>
        </Container>

        <Container>
          <Header title="Social & Contact" subtitle="Facebook QR, Messenger, and location" />
          <div className="grid grid-cols-1 gap-4 px-6 py-4 lg:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="facebook-url">Facebook URL</Label>
              <Input
                id="facebook-url"
                value={settings.facebookUrl}
                onChange={(e) => set({ facebookUrl: e.target.value })}
                placeholder="https://www.facebook.com/..."
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="messenger-url">Messenger URL</Label>
              <Input
                id="messenger-url"
                value={settings.messengerUrl}
                onChange={(e) => set({ messengerUrl: e.target.value })}
                placeholder="https://m.me/..."
              />
            </div>
            <div className="flex flex-col gap-2 lg:col-span-2">
              <Label htmlFor="location-text">Location Text</Label>
              <Input
                id="location-text"
                value={settings.locationText}
                onChange={(e) => set({ locationText: e.target.value })}
                placeholder="Branch address shown at the bottom of the footer"
              />
            </div>
            <div className="flex flex-col gap-2 lg:col-span-2">
              <Label htmlFor="location-url">Location Link</Label>
              <Input
                id="location-url"
                value={settings.locationUrl}
                onChange={(e) => set({ locationUrl: e.target.value })}
                placeholder="https://maps.google.com/..."
              />
            </div>
          </div>
        </Container>

        <Container>
          <Header title="Concierge Section" subtitle="The 'Message Us' block in the footer. Needs messenger url to work" />
          <div className="grid grid-cols-1 gap-4 px-6 py-4 lg:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="concierge-heading">Heading</Label>
              <Input
                id="concierge-heading"
                value={settings.conciergeHeading}
                onChange={(e) => set({ conciergeHeading: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="message-button">Button Label</Label>
              <Input
                id="message-button"
                value={settings.messageButtonLabel}
                onChange={(e) => set({ messageButtonLabel: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2 lg:col-span-2">
              <Label htmlFor="concierge-text">Text</Label>
              <Input
                id="concierge-text"
                value={settings.conciergeText}
                onChange={(e) => set({ conciergeText: e.target.value })}
              />
            </div>
          </div>
        </Container>

        <Container>
          <Header title="Footer Columns" subtitle="Branches and Legal links" />
          <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
            <LinkSection
              title="Branches"
              subtitle="Links in the Branches column"
              links={settings.branchLinks}
              onChange={(links) => set({ branchLinks: links })}
            />
            <LegalSection
              links={settings.legalLinks}
              onChange={(links) => set({ legalLinks: links })}
            />
          </div>
        </Container>

        <Container>
          <Header title="Social Media Icons" subtitle="Icons in the 'Visit Us' area — leave the URL empty to hide the icon" />
          <div className="flex flex-col gap-3 px-6 py-4">
            {SOCIAL_PLATFORMS.map(({ label, Icon }) => {
              const url =
                settings.socials.find((s) => s.label.toLowerCase() === label.toLowerCase())
                  ?.url ?? "";
              return (
                <div key={label} className="flex items-center gap-2">
                  <span className="flex w-36 shrink-0 items-center gap-2 text-sm font-medium text-[var(--fg-base)]">
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </span>
                  <Input
                    value={url}
                    onChange={(e) => {
                      const next = [...settings.socials];
                      const i = next.findIndex(
                        (s) => s.label.toLowerCase() === label.toLowerCase()
                      );
                      if (i >= 0) next[i] = { ...next[i], url: e.target.value };
                      else next.push({ label, url: e.target.value });
                      set({ socials: next });
                    }}
                    placeholder="https://..."
                    className="flex-1 font-medium"
                  />
                </div>
              );
            })}
          </div>
        </Container>

        <Container>
          <Header title="Copyright" subtitle="Bottom line of the footer" />
          <div className="px-6 py-4">
            <Input
              value={settings.copyrightText}
              onChange={(e) => set({ copyrightText: e.target.value })}
              placeholder="© Business, all rights reserved"
            />
          </div>
        </Container>

        <Container>
          <Header
            title="Staff Access Links"
            subtitle="Access links and PINs shared with staff"
            actions={
              <Button variant="primary" size="small" type="button" onClick={createCatalogLink}>
                <Plus className="h-4 w-4" />
                Create Link
              </Button>
            }
          />
          <div className="flex items-start gap-2 border-b border-t border-[var(--tag-red-border)] px-6 py-3">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--tag-red-text)]" />
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-[var(--tag-red-text)]">
                Never share this link with anyone outside your staff.
              </p>
              <p className="text-xs text-[var(--tag-red-text)]">
                If a PIN is leaked, revoke the link immediately.
              </p>
            </div>
          </div>
          <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
            {links.length === 0 && (
              <p className="px-6 py-4 text-sm text-[var(--fg-muted)]">
                No links yet. Create one to share with staff.
              </p>
            )}
            {links.map((link) => {
              const url = `${window.location.origin}/catalog/${link.uid}`;
              const pinVisible = pinVisibleId === link.uid;
              return (
                <div key={link.uid} className="flex flex-col gap-3 px-6 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="text-sm text-[var(--fg-muted)]">Link</span>
                      <code className="max-w-full truncate rounded-md bg-[var(--bg-subtle)] px-2 py-1 font-mono text-xs text-[var(--fg-base)]">
                        {url}
                      </code>
                      <button
                        type="button"
                        onClick={() => copy(url, `link-${link.uid}`)}
                        aria-label="Copy link"
                        className="text-[var(--fg-muted)] hover:text-[var(--fg-base)]"
                      >
                        {copied === `link-${link.uid}` ? (
                          <Check className="h-4 w-4 text-[var(--tag-green-text)]" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {link.active ? (
                        <Badge color="green">Active</Badge>
                      ) : (
                        <Badge color="red">Revoked</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[var(--fg-muted)]">PIN</span>
                      <>
                        <code className="rounded-md bg-[var(--bg-subtle)] px-2 py-1 font-mono text-xs text-[var(--fg-base)]">
                          {pinVisible && link.pin ? link.pin : "••••••••"}
                        </code>
                        <button
                          type="button"
                          onClick={() => setPinVisibleId(pinVisible ? null : link.uid)}
                          aria-label={pinVisible ? "Hide PIN" : "Show PIN"}
                          className="text-[var(--fg-muted)] hover:text-[var(--fg-base)]"
                        >
                          {pinVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const pin = link.pin;
                            if (pin) copy(pin, `pin-${link.uid}`);
                          }}
                          aria-label="Copy PIN"
                          className="text-[var(--fg-muted)] hover:text-[var(--fg-base)]"
                        >
                          {copied === `pin-${link.uid}` ? (
                            <Check className="h-4 w-4 text-[var(--tag-green-text)]" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      </>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-[var(--fg-muted)]">
                        {formatDateTime(link.createdAt)}
                      </span>
                      <ActionMenu
                        items={[
                          ...(link.active
                            ? [
                                {
                                  label: "Revoke",
                                  icon: <Ban className="h-4 w-4" />,
                                  onClick: () => revokeCatalogLink(link.uid),
                                },
                              ]
                            : [
                                {
                                  label: "Delete",
                                  icon: <Trash2 className="h-4 w-4" />,
                                  danger: true,
                                  onClick: () => setDeleteTarget(link.uid),
                                },
                              ]),
                        ]}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Container>

        <Container>
          <Header
            title="Image Storage"
            subtitle="Deletes uploaded images that are no longer used anywhere on the site"
            actions={
              <Button
                variant="secondary"
                size="small"
                type="button"
                onClick={() => setCleanupOpen(true)}
                disabled={cleaning}
              >
                {cleaning ? "Cleaning…" : "Clean unused images"}
              </Button>
            }
          />
          <div className="px-6 py-4">
            <p className="text-xs text-[var(--fg-muted)]">
              Images are kept for 7 days after they stop being used, so recent
              changes are never affected. A weekly automatic cleanup also runs
              on the server.
            </p>
          </div>
        </Container>

        <ConfirmDialog
          open={deleteTarget !== null}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => {
            if (deleteTarget) deleteCatalogLink(deleteTarget);
          }}
          title="Delete link"
          description="This permanently removes the access link. Anyone using it will lose access."
          confirmLabel="Delete"
        />

        <ConfirmDialog
          open={cleanupOpen}
          onClose={() => setCleanupOpen(false)}
          onConfirm={() => {
            void handleCloudinaryCleanup();
          }}
          title="Clean unused images"
          description="This permanently deletes uploaded images that haven't been used by any product, page, or setting in the last 7 days. This cannot be undone."
          confirmLabel="Run cleanup"
        />
      </form>
    </div>
  );
}