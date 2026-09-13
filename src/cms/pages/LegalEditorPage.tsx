import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useCms } from "../store/cmsContext";
import { useToast } from "../components/toastContext";
import { Button, Label, Textarea } from "../components/ui";

function deriveSlug(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function LegalEditorPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { settings, updateSettings, flushSaves } = useCms();
  const { showToast } = useToast();

  const index = settings.legalLinks.findIndex(
    (l) => deriveSlug(l.label) === slug
  );
  const page = index >= 0 ? settings.legalLinks[index] : null;

  const [body, setBody] = useState(page?.body ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBody(page?.body ?? "");
  }, [page]);

  if (!page) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <p className="text-sm text-[var(--fg-muted)]">Legal page not found.</p>
        <Button variant="secondary" size="small" onClick={() => navigate("/cms-admin/settings")}>
          Back to Settings
        </Button>
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      const next = [...settings.legalLinks];
      next[index] = { ...next[index], body };
      updateSettings({ legalLinks: next });
      await flushSaves();
      showToast("Legal page saved.");
    } catch {
      showToast("Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-col overflow-hidden" style={{ height: "calc(100dvh - 5.5rem)" }}>
      <div className="flex items-center justify-between pb-3">
        <button
          type="button"
          onClick={() => navigate("/cms-admin/settings")}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--fg-muted)] hover:text-[var(--fg-base)] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </button>
        <Button variant="primary" size="small" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-hidden">
        <Label>Content (Markdown)</Label>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your legal content here using markdown..."
          className="flex-1 resize-none font-mono text-xs !max-h-none focus-visible:shadow-none"
          style={{ minHeight: 0 }}
        />
      </div>
    </div>
  );
}
