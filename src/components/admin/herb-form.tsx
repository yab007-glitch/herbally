import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Database } from "@/lib/types/database";

type Herb = Database["public"]["Tables"]["herbs"]["Row"];

interface HerbFormProps {
  // Server action bound to the <form>. For edit, the action receives the herb
  // id via a hidden field. Typed loosely (unknown return) so we can accept the
  // real ActionResponse-returning actions and still satisfy React's strict
  // `void | Promise<void>` form-action signature at the JSX boundary.
  action: (formData: FormData) => unknown;
  mode: "create" | "edit";
  herb?: Herb;
}

function CheckboxField({
  id,
  name,
  label,
  defaultChecked,
}: {
  id: string;
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  // Native checkbox (not Radix Switch) — Switch renders a <button> which does
  // not submit a value in a native form, so the boolean would never reach the
  // server action. A checkbox submits `on` when checked, which the action
  // interprets as presence === true.
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="size-4 rounded border-input accent-primary"
      />
      <Label htmlFor={id}>{label}</Label>
    </div>
  );
}

export function HerbForm({ action, mode, herb }: HerbFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Herb Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          action={action as (formData: FormData) => void | Promise<void>}
          className="space-y-4"
        >
          {herb && <input type="hidden" name="id" value={herb.id} />}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Common Name</Label>
              <Input
                id="name"
                name="name"
                defaultValue={herb?.name}
                placeholder="e.g. Turmeric"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scientific_name">Scientific Name</Label>
              <Input
                id="scientific_name"
                name="scientific_name"
                defaultValue={herb?.scientific_name}
                placeholder="e.g. Curcuma longa"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="common_names">
              Common Names / Aliases{" "}
              <span className="text-xs text-muted-foreground">
                (comma-separated)
              </span>
            </Label>
            <Input
              id="common_names"
              name="common_names"
              defaultValue={herb?.common_names?.join(", ") ?? ""}
              placeholder="e.g. Indian saffron, golden spice"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={herb?.description}
              placeholder="Describe the herb, its origins, and primary uses..."
              rows={4}
              required
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dosage_adult">Adult Dosage</Label>
              <Input
                id="dosage_adult"
                name="dosage_adult"
                defaultValue={herb?.dosage_adult ?? ""}
                placeholder="e.g. 500-2000mg daily"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dosage_child">Child Dosage</Label>
              <Input
                id="dosage_child"
                name="dosage_child"
                defaultValue={herb?.dosage_child ?? ""}
                placeholder="e.g. consult practitioner"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <CheckboxField
              id="pregnancy_safe"
              name="pregnancy_safe"
              label="Pregnancy Safe"
              defaultChecked={herb?.pregnancy_safe ?? false}
            />
            <CheckboxField
              id="nursing_safe"
              name="nursing_safe"
              label="Nursing Safe"
              defaultChecked={herb?.nursing_safe ?? false}
            />
            <CheckboxField
              id="is_published"
              name="is_published"
              label="Published"
              defaultChecked={herb?.is_published ?? true}
            />
          </div>
          <Button type="submit" className="w-full">
            {mode === "create" ? "Create Herb" : "Save Changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
