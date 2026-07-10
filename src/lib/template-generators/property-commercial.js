import { generateScript as generateGenericScript } from "./generic";

// Property Commercial's own script generator. It reuses the generic
// SiteForm-driven generator for now, but lives in its own module — same as
// every other template will — so its prompt, model, or provider can diverge
// freely later (e.g. swap to a commercial-listing-specific prompt) without
// touching any other template.
export async function generateScript({ template, values }) {
  return generateGenericScript({ template, values });
}
