import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useCms } from "../store/cmsContext";
import type { AboutPageConfig } from "../../data/store-types";
import { ABOUT_KEY } from "../../data/store-defaults";
import { Button, Container, Header, Input, Label } from "../components/ui";
import { useToast } from "../store/toastContext";
import { UploadButton } from "../components/UploadButton";
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

  const handleHero = (patch: Partial<Pick<AboutPageConfig, "heroHeading" | "heroSubtitle" | "heroImage" | "mobileHeroImage" | "heroTextBlack">>) => {
    updateAbout(patch);
  };

  const handleSection = (index: number, patch: Partial<SectionData>) => {
    const next = about.sections.map((s, i) => (i === index ? { ...s, ...patch } : s));
    updateAbout({ sections: next });
  };

  const handleMoveSection = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= about.sections.length) return;
    const next = [...about.sections];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
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
          cardStyle: "feature",
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
    <div className="flex flex-col gap-y-3">
      <Header
        title="About Page"
        subtitle="Customize the hero and content sections on the About Us page. Changes apply when you click Save."
        actions={
          <Button
            variant="primary"
            size="header"
            type="button"
            onClick={handleSave}
            disabled={saving || !isDirty}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        }
      />

      <Container>
        <div className="flex flex-col gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-[var(--fg-base)]">Hero</h2>
            <button
              type="button"
              onClick={() => handleHero({ heroTextBlack: !about.heroTextBlack })}
              aria-label={about.heroTextBlack ? "Show title in white" : "Show title in black"}
              aria-pressed={!!about.heroTextBlack}
              className={`h-5 w-5 shrink-0 rounded-full border transition-colors ${
                about.heroTextBlack
                  ? "border-black bg-black"
                  : "border-[var(--border-base)] bg-white"
              }`}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            <div className="flex flex-wrap items-center gap-3">
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
            <div className="flex flex-wrap items-center gap-3">
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

      <Container>
        <Header
          title="Content Sections"
          subtitle="Ordered blocks shown on the About page"
          actions={
            <Button variant="secondary" size="small" onClick={handleAddSection}>
              <Plus className="h-4 w-4" />
              Add Section
            </Button>
          }
        />
        <div className="flex flex-col gap-3 px-4 py-4 sm:px-6">
          {about.sections.map((section, i) => (
            <SectionEditor
              key={section.id}
              section={section}
              index={i}
              canMoveUp={i > 0}
              canMoveDown={i < about.sections.length - 1}
              onMoveUp={() => handleMoveSection(i, -1)}
              onMoveDown={() => handleMoveSection(i, 1)}
              onChange={(patch) => handleSection(i, patch)}
              onDelete={() => handleDeleteSection(i)}
            />
          ))}
          {about.sections.length === 0 && (
            <p className="text-sm text-[var(--fg-muted)]">No sections yet.</p>
          )}
        </div>
      </Container>
    </div>
  );
}
