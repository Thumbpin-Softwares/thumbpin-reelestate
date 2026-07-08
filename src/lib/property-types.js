// Shared property-type taxonomy for the AI "Write Script" forms across all
// reel pipelines (comedy-reel, luxury-car-exit, action-reel). Replaces the old
// free-text "Type" input with a structured selector so the generated script
// can adapt its angle — ownership vs rental vs stay, residential vs commercial
// vs land — to the kind of property being marketed.
//
// Single source of truth: the three StepScript forms render PROPERTY_TYPE_GROUPS
// and read field hints via getPropertyType(); the generate-script API receives
// the resolved { type label, transaction } and tailors the prompt accordingly.

export const DEFAULT_PROPERTY_TYPE = "apartment";

// Grouped for <optgroup> rendering. `transaction` drives price wording and the
// listing angle the script writer uses (see transactionMap in the API route).
export const PROPERTY_TYPE_GROUPS = [
  {
    label: "Buy / Sale",
    transaction: "sale",
    types: [
      { id: "apartment", label: "Apartment" },
      { id: "villa", label: "Villa" },
      { id: "independent_house", label: "Independent House" },
      { id: "plot", label: "Plot / Land" },
      { id: "farmhouse", label: "Farmhouse" },
      { id: "affordable_house", label: "Affordable House" },
      { id: "affordable_shop", label: "Affordable Shop" },
      { id: "commercial_shop", label: "Commercial Shop (Mall)" },
    ],
  },
  {
    label: "Rent",
    transaction: "rent",
    types: [
      { id: "rent_flat", label: "Flat / Apartment" },
      { id: "rent_house", label: "House" },
      { id: "rent_shop", label: "Shop" },
      { id: "rent_farmhouse", label: "Farmhouse" },
      { id: "rent_banquet", label: "Banquet Hall" },
    ],
  },
  {
    label: "Stay",
    transaction: "stay",
    types: [
      { id: "hotel", label: "Hotel Room" },
      { id: "bnb", label: "Airbnb / Homestay" },
    ],
  },
];

// Price field wording per transaction — the value still lives in qaAnswers.price;
// only the label/placeholder shown to the user changes.
const TRANSACTION_DEFAULTS = {
  sale: { priceLabel: "Price", pricePlaceholder: "e.g. ₹7 Cr onwards" },
  rent: { priceLabel: "Rent (per month)", pricePlaceholder: "e.g. ₹85,000 / month" },
  stay: { priceLabel: "Tariff (per night)", pricePlaceholder: "e.g. ₹8,000 / night" },
};

// Per-type "size / configuration" wording. Falls back to a residential default.
const SIZE_DEFAULT = { sizeLabel: "Configuration / Size", sizePlaceholder: "e.g. 3 BHK · 2400 sq ft" };
const TYPE_HINTS = {
  apartment: SIZE_DEFAULT,
  villa: { sizeLabel: "Configuration / Size", sizePlaceholder: "e.g. 4 BHK · 3500 sq ft" },
  independent_house: { sizeLabel: "Configuration / Size", sizePlaceholder: "e.g. 3 BHK · 2000 sq ft" },
  plot: { sizeLabel: "Plot Area", sizePlaceholder: "e.g. 250 sq yd" },
  farmhouse: { sizeLabel: "Land + Built-up", sizePlaceholder: "e.g. 1 acre · 4 BHK" },
  affordable_house: { sizeLabel: "Configuration / Size", sizePlaceholder: "e.g. 2 BHK · 900 sq ft" },
  affordable_shop: { sizeLabel: "Carpet Area", sizePlaceholder: "e.g. 200 sq ft" },
  commercial_shop: { sizeLabel: "Carpet Area", sizePlaceholder: "e.g. 500 sq ft" },
  rent_flat: { sizeLabel: "Configuration / Size", sizePlaceholder: "e.g. 2 BHK · 1200 sq ft" },
  rent_house: { sizeLabel: "Configuration / Size", sizePlaceholder: "e.g. 3 BHK · 1800 sq ft" },
  rent_shop: { sizeLabel: "Carpet Area", sizePlaceholder: "e.g. 400 sq ft" },
  rent_farmhouse: { sizeLabel: "Capacity / Area", sizePlaceholder: "e.g. 1 acre · sleeps 12" },
  rent_banquet: { sizeLabel: "Guest Capacity", sizePlaceholder: "e.g. 300–500 guests" },
  hotel: { sizeLabel: "Room Type", sizePlaceholder: "e.g. Deluxe · sleeps 2" },
  bnb: { sizeLabel: "Capacity", sizePlaceholder: "e.g. 2 BHK · sleeps 6" },
};

// Resolve a type id to its full config: display label, transaction, and the
// adapted price/size field wording. Returns null for an unknown id so callers
// can fall back to DEFAULT_PROPERTY_TYPE.
export function getPropertyType(id) {
  for (const group of PROPERTY_TYPE_GROUPS) {
    const t = group.types.find((x) => x.id === id);
    if (t) {
      return {
        ...t,
        transaction: group.transaction,
        ...TRANSACTION_DEFAULTS[group.transaction],
        ...(TYPE_HINTS[id] || SIZE_DEFAULT),
      };
    }
  }
  return null;
}
