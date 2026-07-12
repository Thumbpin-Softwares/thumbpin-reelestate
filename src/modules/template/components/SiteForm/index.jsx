"use client";

import { FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CLASSIFICATIONS = [
  { id: "commercial", label: "Commercial" },
  { id: "residential", label: "Residential" },
  { id: "plotted", label: "Plotted" },
];

const GLOBAL_REQUIRED = ["propertyClassification", "projectName", "projectType", "projectArea", "location", "tonality"];

// Checks the fields required for the current classification. Residential
// and Plotted only require Carpet Area beyond the global set; Commercial
// additionally requires Shop Type + Shop Built-up Area.
export function isSiteFormValid(values = {}) {
  const filled = (key) => !!values[key]?.toString().trim();
  if (!GLOBAL_REQUIRED.every(filled)) return false;

  if (values.propertyClassification === "commercial") {
    return filled("shopType") && filled("shopBuiltUpArea");
  }
  if (values.propertyClassification === "residential" || values.propertyClassification === "plotted") {
    return filled("carpetArea");
  }
  return false;
}

const PROJECT_TYPES = [
  { id: "affordable", label: "Affordable" },
  { id: "luxury", label: "Luxury" },
  { id: "ultra-luxury", label: "Ultra Luxury" },
];

function FieldLabel({ children, required }) {
  return (
    <Label className="text-xs text-neutral-700">
      {children}
      {required ? <span className="text-red-500 ml-0.5">*</span> : <span className="text-neutral-400 ml-1">(Optional)</span>}
    </Label>
  );
}

function TextField({ label, field, values, setField, required, placeholder, hint, textarea }) {
  const Comp = textarea ? Textarea : Input;
  return (
    <div className="space-y-1.5">
      <FieldLabel required={required}>{label}</FieldLabel>
      <Comp
        value={values[field] || ""}
        onChange={(e) => setField(field, e.target.value)}
        placeholder={placeholder}
        className={textarea ? "min-h-20 resize-none text-sm" : "text-sm"}
      />
      {hint && <p className="text-[11px] text-neutral-400">{hint}</p>}
    </div>
  );
}

// Shared "Script" step form — collects the details used to generate the
// script/voice for a template's pipeline. Shared across all templates;
// which fields render depends on Property Classification, but the form
// shell itself is the same everywhere.
//
// Controlled via `values` + `onChange(nextValues)` so a field can be added
// with `setField("key", val)` without each template managing its own
// individual useState per field.
export function SiteForm({ values = {}, onChange }) {
  const setField = (key, val) => onChange?.({ ...values, [key]: val });
  const classification = values.propertyClassification;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-neutral-900 flex items-center justify-center">
          <FileText className="w-4 h-4 text-[#c7f038]" />
        </div>
        <h3 className="text-sm font-semibold">Site Details</h3>
      </div>

      {/* ── Global fields ── */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <FieldLabel required>Property Classification</FieldLabel>
          <div className="flex gap-2 flex-wrap">
            {CLASSIFICATIONS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setField("propertyClassification", c.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  classification === c.id
                    ? "bg-neutral-900 text-[#c7f038]"
                    : "border border-border text-muted-foreground hover:border-neutral-400"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <TextField label="Project Name" field="projectName" values={values} setField={setField} required />

          <div className="space-y-1.5">
            <FieldLabel required>Project Type</FieldLabel>
            <Select value={values.projectType || ""} onValueChange={(v) => setField("projectType", v)}>
              <SelectTrigger className="w-full text-sm">
                <SelectValue placeholder="Select project type" />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_TYPES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <TextField
            label="Project Area"
            field="projectArea"
            values={values}
            setField={setField}
            required
            placeholder="e.g., 5 acres, 2.5M sqft township"
            hint="Total built-up area, township area, or project area"
          />
          <TextField label="Location" field="location" values={values} setField={setField} required />
        </div>

        <TextField
          label="Tonality"
          field="tonality"
          values={values}
          setField={setField}
          required
          placeholder="e.g., Aspirational, premium, warm & inviting"
          hint="Guides the AI's tone for the generated script"
          textarea
        />

        <div className="grid sm:grid-cols-2 gap-4">
          <TextField label="Landmarks" field="landmarks" values={values} setField={setField} />
          <TextField label="Connectivity" field="connectivity" values={values} setField={setField} />
        </div>
      </div>

      {/* ── Commercial ── */}
      {classification === "commercial" && (
        <div className="space-y-4 rounded-xl border border-border/50 p-4 bg-card/50">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Commercial Details</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <TextField label="Shop Type" field="shopType" values={values} setField={setField} required />
            <TextField label="Shop Built-up Area" field="shopBuiltUpArea" values={values} setField={setField} required />
            <TextField label="Footfall" field="footfall" values={values} setField={setField} />
            <TextField label="Brand Relationships" field="brandRelationships" values={values} setField={setField} />
          </div>
          <TextField label="Revenue Potential" field="revenuePotential" values={values} setField={setField} textarea />
        </div>
      )}

      {/* ── Residential ── */}
      {classification === "residential" && (
        <div className="space-y-4 rounded-xl border border-border/50 p-4 bg-card/50">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Residential Details</p>
          <TextField
            label="Carpet Area"
            field="carpetArea"
            values={values}
            setField={setField}
            required
            placeholder="e.g., 1200 sqft, 3600 sqft"
          />
          <TextField label="Amenities" field="amenities" values={values} setField={setField} textarea />
          <TextField
            label="Features"
            field="features"
            values={values}
            setField={setField}
            textarea
            hint="Focus on nearby developments"
          />
        </div>
      )}

      {/* ── Plotted ── */}
      {classification === "plotted" && (
        <div className="space-y-4 rounded-xl border border-border/50 p-4 bg-card/50">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Plotted Details</p>
          <TextField label="Carpet Area" field="carpetArea" values={values} setField={setField} required />

          <div className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2.5">
            <div>
              <p className="text-xs font-medium text-neutral-700">Gated Community</p>
              <p className="text-[11px] text-neutral-400">Optional</p>
            </div>
            <Switch
              checked={!!values.gatedCommunity}
              onCheckedChange={(v) => setField("gatedCommunity", v)}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <TextField label="Water Supply and Area Type" field="waterSupplyAreaType" values={values} setField={setField} />
            <TextField label="Nearby Settlements" field="nearbySettlements" values={values} setField={setField} />
          </div>
          <TextField label="Amenities" field="amenities" values={values} setField={setField} textarea />
          <TextField label="Features" field="features" values={values} setField={setField} textarea />
        </div>
      )}
    </div>
  );
}
