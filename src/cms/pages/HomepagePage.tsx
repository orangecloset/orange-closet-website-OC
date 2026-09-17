import { useState } from "react";
import { Plus } from "lucide-react";
import { useCms } from "../store/cmsContext";
import { HOMEPAGE_KEY } from "../store/defaults";
import { Button, Container, Header, Switch } from "../components/ui";
import { useToast } from "../store/toastContext";
import { HeroCard } from "../components/HeroCard";
import { BrandList } from "../components/BrandList";
import { ProductSection } from "../components/ProductSection";

const MAX_HEROES = 10;

export default function HomepagePage() {
  const { homepage, configDirty, updateHomepage, flushSaves } = useCms();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const isDirty = configDirty.includes(HOMEPAGE_KEY);

  const handleSave = async () => {
    setSaving(true);
    try {
      await flushSaves();
      showToast("Homepage saved.");
    } catch {
      showToast("Couldn't save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const addHero = () => {
    if (homepage.heroes.length >= MAX_HEROES) return;
    updateHomepage({
      heroes: [
        ...homepage.heroes,
        { id: `hero-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, label: "", subtitle: "", src: "", mobileSrc: "", to: "/bags", wide: false },
      ],
    });
  };

  return (
    <div className="flex flex-col gap-y-3">
      <Header
        title="Homepage"
        subtitle="Edit hero banners, brands, and product sections shown on the storefront homepage. Changes apply when you click Save."
        actions={
          <Button
            variant="primary"
            size="small"
            type="button"
            onClick={handleSave}
            disabled={saving || !isDirty}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        }
      />

      <Container>
        <div className="flex items-center justify-between px-6 py-4">
          <span className="text-sm text-[var(--fg-muted)]">Hero image clickable</span>
          <Switch
            checked={homepage.heroImageClickable}
            onCheckedChange={(heroImageClickable) => updateHomepage({ heroImageClickable })}
          />
        </div>
      </Container>

      <Container>
        <div className="flex items-center justify-between px-6 py-4">
          <span className="text-sm text-[var(--fg-muted)]">Show On Sale section</span>
          <Switch
            checked={homepage.showOnSale}
            onCheckedChange={(showOnSale) => updateHomepage({ showOnSale })}
          />
        </div>
      </Container>

      <Container>
        <div className="flex items-center justify-between px-6 py-4">
          <span className="text-sm text-[var(--fg-muted)]">Show New Arrivals section</span>
          <Switch
            checked={homepage.showNewArrivals}
            onCheckedChange={(showNewArrivals) => updateHomepage({ showNewArrivals })}
          />
        </div>
      </Container>

      <Container>
        <Header
          title="Hero Banners"
          subtitle="Hero images with text and navigation."
          actions={
            <Button
              variant="primary"
              size="small"
              onClick={addHero}
              disabled={homepage.heroes.length >= MAX_HEROES}
            >
              <Plus className="h-4 w-4" />
              Add Hero
            </Button>
          }
        />
        <div className="grid grid-cols-1 gap-3 px-6 py-4 lg:grid-cols-2">
          {homepage.heroes.map((hero) => (
            <HeroCard key={hero.id} hero={hero} />
          ))}
          {homepage.heroes.length === 0 && (
            <p className="px-2 py-2 text-sm text-[var(--fg-muted)]">
              No heroes yet — add up to {MAX_HEROES}.
            </p>
          )}
        </div>
      </Container>

      <BrandList />

      <ProductSection
        title="Featured Products"
        subtitle="Curated manually: pick products for the Featured carousel"
        ids={homepage.featuredIds}
        field="featuredIds"
      />

      <ProductSection
        title="Best Sellers"
        subtitle="Curated manually: pick products for the Best Sellers section"
        ids={homepage.bestSellerIds}
        field="bestSellerIds"
      />
    </div>
  );
}