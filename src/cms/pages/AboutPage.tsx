import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useCms } from "../store/cmsContext";
import type { AboutPageConfig } from "../store/types";
import { ABOUT_KEY } from "../store/defaults";
import { Button, Container, Input, Label } from "../components/ui";
import { useToast } from "../store/toastContext";
import { UploadButton } from "../components/UploadButton";
import { SortableList, DragHandle } from "../components/SortableList";
import { SectionEditor } from "../components/AboutSectionEditor";
import type { SectionData } from "../components/AboutSectionEditor";

export default function AboutPage() {
  const { about, configDirty, updateAbout, flushSaves } = useCms();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const isDirty = configDirty.includes(ABOUT_KEY);

  const handleSave = async () => {
    setSaving(true);
    try {
      await flushSaves();
      showToast("About page saved.");
    } catch {
      showToast("Couldn't save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleHero = (patch: Partial<Pick<AboutPageConfig, "heroHeading" | "heroSubtitle" | "heroImage" | "mobileHeroImage">>) => {
    updateAbout(patch);
  };

  const handleSection = (index: number, patch: Partial<SectionData>) => {
    const next = about.sections.map((s, i) => (i === index ? { ...s, ...patch } : s));
    updateAbout({ sections: next });
  };

  const handleReorderSections = (next: SectionData[]) => {
    updateAbout({ sections: next });
  };

  const handleAddSection = () => {
    updateAbout({
      sections: [
        ...about.sections,
        {
          id: `section-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          label: "",
          enabled: true,
          heading: "",
          body: [],
          images: [],
          cards: [],
          closingText: "",
          ctaLabel: "",
          ctaUrl: "",
        },
      ],
    });
  };

  const handleDeleteSection = (index: number) => {
    updateAbout({ sections: about.sections.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-[var(--fg-base)]">About Page</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            Customize the hero and content sections on the About Us page.
            Changes apply when you click Save.
          </p>
        </div>
        <Button
          variant="primary"
          size="small"
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="shrink-0"
        >
          {saving ? "Saving…" : isDirty ? "Save changes" : "Save"}
        </Button>
      </div>

      <Container>
        <div className="space-y-4 px-4 py-4">
          <h2 className="text-[13px] font-medium text-[var(--fg-base)]">Hero</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Subtitle</Label>
              <Input
                value={about.heroSubtitle}
                onChange={(e) => handleHero({ heroSubtitle: e.target.value })}
                placeholder="About Us"
              />
            </div>
            <div>
              <Label>Heading</Label>
              <Input
                value={about.heroHeading}
                onChange={(e) => handleHero({ heroHeading: e.target.value })}
                placeholder="Our Story"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Hero Image</Label>
            <div className="flex items-center gap-3">
              {about.heroImage && (
                <img
                  src={about.heroImage}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded object-cover bg-[var(--bg-subtle)]"
                />
              )}
              <UploadButton
                onUploaded={(url) => handleHero({ heroImage: url })}
                label={about.heroImage ? "Replace" : "Upload"}
                preset="hero"
              />
              {about.heroImage && (
                <Button variant="ghost" size="small" type="button" onClick={() => handleHero({ heroImage: "" })}>
                  <X className="h-4 w-4" />
                  Remove
                </Button>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Mobile Hero Image</Label>
            <div className="flex items-center gap-3">
              {about.mobileHeroImage && (
                <img
                  src={about.mobileHeroImage}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded object-cover bg-[var(--bg-subtle)]"
                />
              )}
              <UploadButton
                onUploaded={(url) => handleHero({ mobileHeroImage: url })}
                label={about.mobileHeroImage ? "Replace" : "Upload"}
                preset="hero"
              />
              {about.mobileHeroImage && (
                <Button variant="ghost" size="small" type="button" onClick={() => handleHero({ mobileHeroImage: "" })}>
                  <X className="h-4 w-4" />
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>
      </Container>

      <div className="space-y-3">
        <SortableList
          items={about.sections}
          onReorder={handleReorderSections}
          keyExtractor={(s) => s.id}
          renderItem={(section, i, dragHandleProps) => (
            <div className="flex items-start gap-2">
              <div className="mt-3">
                <DragHandle handleProps={dragHandleProps} />
              </div>
              <div className="flex-1">
                <SectionEditor
                  section={section}
                  index={i}
                  onChange={(patch) => handleSection(i, patch)}
                  onDelete={() => handleDeleteSection(i)}
                />
              </div>
            </div>
          )}
        />
        <Button variant="secondary" size="base" onClick={handleAddSection}>
          <Plus className="h-4 w-4" />
          Add Section
        </Button>
      </div>
    </div>
  );
}
