// hooks/usePropertyBrief.js
import { useState } from "react";

export const usePropertyBrief = () => {
  const [propertyDrawerOpen, setPropertyDrawerOpen] = useState(false);
  const [propertyBrief, setPropertyBrief] = useState({
    description: "", // Main property description
    location: "",
    price: "",
    bedrooms: "",
    bathrooms: "",
    area: "",
  });

  const updatePropertyBrief = (updates) => {
    setPropertyBrief((prev) => ({ ...prev, ...updates }));
  };

  const getFilledCount = () => {
    let count = 0;
    if (propertyBrief.description) count++;
    if (propertyBrief.location) count++;
    if (propertyBrief.price) count++;
    if (propertyBrief.bedrooms) count++;
    if (propertyBrief.bathrooms) count++;
    if (propertyBrief.area) count++;
    return count;
  };

  return {
    propertyBrief,
    setPropertyBrief,
    updatePropertyBrief,
    propertyDrawerOpen,
    setPropertyDrawerOpen,
    getFilledCount,
  };
};