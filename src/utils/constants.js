export const MAX_SCRIPT = 200;
export const MAX_RETRY_ATTEMPTS = 3;
export const STORAGE_KEY = 're_video_session';

export const STEPS = ["Upload & Avatar", "Pick Composite", "Script & Generate"];

export const LANGUAGES = [
  { id: "english", label: "English" },
  { id: "hindi", label: "Hindi" },
  { id: "hinglish", label: "Hinglish" },
  { id: "marathi", label: "Marathi" },
  { id: "tamil", label: "Tamil" },
  { id: "telugu", label: "Telugu" },
  { id: "kannada", label: "Kannada" },
  { id: "malayalam", label: "Malayalam" },
  { id: "bengali", label: "Bengali" },
  { id: "gujarati", label: "Gujarati" },
  { id: "punjabi", label: "Punjabi" },
  { id: "urdu", label: "Urdu" },
  { id: "odia", label: "Odia" },
];

export const TONES = [
  { id: "professional", label: "Professional" },
  { id: "luxury", label: "Luxury" },
  { id: "casual", label: "Casual" },
  { id: "energetic", label: "Energetic" },
  { id: "storytelling", label: "Storytelling" },
  { id: "urgent", label: "Urgent" },
  { id: "aspirational", label: "Aspirational" },
];

export const PROPERTY_TYPES = [
  "1 BHK Apartment", "2 BHK Apartment", "3 BHK Apartment", "4 BHK Apartment",
  "Villa", "Penthouse", "Studio", "Independent House", "Plot",
  "Farmhouse", "Commercial Space", "Row House", "Duplex",
];

export const PRICE_RANGES = [
  { id: "30-50L", label: "₹30-50L" },
  { id: "50L-1Cr", label: "₹50L-1Cr" },
  { id: "1-2Cr", label: "₹1-2Cr" },
  { id: "2-5Cr", label: "₹2-5Cr" },
  { id: "5Cr+", label: "₹5Cr+" },
  { id: "custom", label: "Custom" },
];

export const KEY_FEATURES = [
  "Modular Kitchen", "Floor-to-Ceiling Windows", "Park View", "Balcony",
  "Smart Home", "Italian Marble", "Walk-in Closet", "Home Office",
  "Servant Room", "Pooja Room", "City View", "Open Kitchen",
  "French Windows", "Wooden Flooring", "Designer Bathroom",
];

export const AMENITIES = [
  { id: "pool", label: "Pool", emoji: "🏊" },
  { id: "gym", label: "Gym", emoji: "🏋️" },
  { id: "clubhouse", label: "Clubhouse", emoji: "🎾" },
  { id: "parking", label: "Parking", emoji: "🅿️" },
  { id: "garden", label: "Garden", emoji: "🌳" },
  { id: "security", label: "24/7 Security", emoji: "🛡️" },
  { id: "jogging", label: "Jogging Track", emoji: "🏃" },
  { id: "playground", label: "Kids Play Area", emoji: "🎪" },
  { id: "power", label: "Power Backup", emoji: "⚡" },
  { id: "lift", label: "Lift", emoji: "🛗" },
  { id: "intercom", label: "Intercom", emoji: "📞" },
  { id: "cctv", label: "CCTV", emoji: "📷" },
];

export const FURNISHING_OPTIONS = ["Unfurnished", "Semi-Furnished", "Fully Furnished"];
export const FACING_OPTIONS = ["North", "South", "East", "West", "NE", "NW", "SE", "SW"];
export const FLOOR_OPTIONS = ["Ground", "1-5", "6-10", "11-20", "20+", "Top Floor", "Duplex"];

export const AVATAR_MODES = [
  { id: "prebuilt", label: "RE Agents", icon: "PersonStanding" },
  { id: "library", label: "Your Library", icon: "BookMarked" },
  { id: "upload", label: "Upload", icon: "Upload" },
  { id: "generate", label: "Create Avatar", icon: "Sparkles" },
];

export const CLOSING_HOOK_OPTIONS = [
  {
    id: "none",
    label: "No Special Hook",
    prompt: "Keep the ending clean, confident, and premium with no extra closing gimmick."
  },
  {
    id: "key_handover_happy",
    label: "Happy Key Handover",
    prompt: "Final beat: presenter warmly hands over keys to a happy buyer couple (silent extras only), smiles to camera."
  },
  {
    id: "sunset_balcony_toast",
    label: "Balcony Sunset Moment",
    prompt: "Final beat: presenter gestures toward sunset balcony view and closes with warm aspirational emotion."
  },
  {
    id: "door_open_reveal",
    label: "Door Open Final Reveal",
    prompt: "Final beat: presenter opens a door into the best room and invites the viewer in with a confident smile."
  },
  {
    id: "light_humor_line",
    label: "Light Classy Humor",
    prompt: "Final beat: include one short classy witty line (not slapstick), then end with premium confidence."
  },
  {
    id: "family_entry_silent",
    label: "Family Entry (Silent)",
    prompt: "Final beat: a small family appears in background silently, presenter smiles and signals handover/homecoming."
  },
  {
    id: "signature_key_toss",
    label: "Signature Key Gesture",
    prompt: "Final beat: presenter does a subtle signature key gesture (no dramatic toss), then steady confident close."
  },
  {
    id: "warm_handshake_close",
    label: "Warm Handshake Close",
    prompt: "Final beat: presenter shares a brief warm handshake with buyer (silent), then turns to camera for final line."
  },
];