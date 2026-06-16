import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Building2, CheckCircle2 } from "lucide-react";

export const PropertyDrawer = ({
  isOpen,
  onClose,
  propertyBrief,
  updatePropertyBrief,
}) => {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="overflow-y-auto w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-base">
            <Building2 className="w-4 h-4 text-primary" /> Property Details
          </SheetTitle>
          <SheetDescription className="text-xs">
            Describe your property in your own words. This helps the AI write a 
            more relevant script and create better composites.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-6">
          {/* Simple text area for property description */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Property Description</Label>
            <Textarea
              value={propertyBrief.description || ""}
              onChange={(e) =>
                updatePropertyBrief({ description: e.target.value })
              }
              placeholder="e.g., A luxurious 3BHK apartment in South Delhi with modern interiors, floor-to-ceiling windows, and a private terrace. The kitchen has quartz countertops and smart appliances. The master bedroom includes a walk-in closet. The building features a rooftop pool, gym, and 24/7 security."
              className="min-h-[200px] resize-none text-sm"
            />
            <p className="text-[10px] text-muted-foreground">
              Be as detailed as you want — mention key features, location, size, amenities, etc.
            </p>
          </div>

          {/* Optional: Quick location field */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Location (optional)</Label>
            <input
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="e.g., Gurgaon Sector 49, Mumbai Bandra West"
              value={propertyBrief.location || ""}
              onChange={(e) =>
                updatePropertyBrief({ location: e.target.value })
              }
            />
          </div>

          {/* Optional: Price (optional) */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Price (optional)</Label>
            <input
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="e.g., ₹1.2 Cr or ₹35,000/month"
              value={propertyBrief.price || ""}
              onChange={(e) =>
                updatePropertyBrief({ price: e.target.value })
              }
            />
          </div>

          {/* Optional: Bed/Bath (optional) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Bedrooms (optional)</Label>
              <input
                type="number"
                min="0"
                max="10"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={propertyBrief.bedrooms || ""}
                onChange={(e) =>
                  updatePropertyBrief({ bedrooms: parseInt(e.target.value) || 0 })
                }
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Bathrooms (optional)</Label>
              <input
                type="number"
                min="0"
                max="10"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={propertyBrief.bathrooms || ""}
                onChange={(e) =>
                  updatePropertyBrief({ bathrooms: parseInt(e.target.value) || 0 })
                }
              />
            </div>
          </div>

          {/* Optional: Area (optional) */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Area (optional)</Label>
            <input
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="e.g., 1650 sq ft"
              value={propertyBrief.area || ""}
              onChange={(e) =>
                updatePropertyBrief({ area: e.target.value })
              }
            />
          </div>

          <Button
            onClick={onClose}
            className="w-full gradient-bg text-white shadow-md cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5" /> Save & Continue
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};