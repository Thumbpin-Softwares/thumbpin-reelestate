// ========================================
// Mock Data for development without Supabase
// ========================================

export const mockUser = {
  id: "mock-user-001",
  email: "demo@thumbai.in",
  credits: 10,
  subscription_tier: "free",
  created_at: "2025-01-15T10:30:00Z",
};

export const mockAvatars = [
  { id: "av-01", name: "Priya Sharma", image_url: "/avatars/placeholder.svg", ethnicity: "North Indian Female", preview_video: null },
  { id: "av-02", name: "Rahul Verma", image_url: "/avatars/placeholder.svg", ethnicity: "North Indian Male", preview_video: null },
  { id: "av-03", name: "Sneha Nair", image_url: "/avatars/placeholder.svg", ethnicity: "South Indian Female", preview_video: null },
  { id: "av-04", name: "Arjun Menon", image_url: "/avatars/placeholder.svg", ethnicity: "South Indian Male", preview_video: null },
  { id: "av-05", name: "Ananya Patel", image_url: "/avatars/placeholder.svg", ethnicity: "Gujarati Female", preview_video: null },
  { id: "av-06", name: "Vikram Singh", image_url: "/avatars/placeholder.svg", ethnicity: "Punjabi Male", preview_video: null },
  { id: "av-07", name: "Kavya Reddy", image_url: "/avatars/placeholder.svg", ethnicity: "Telugu Female", preview_video: null },
  { id: "av-08", name: "Aditya Kumar", image_url: "/avatars/placeholder.svg", ethnicity: "Hindi Belt Male", preview_video: null },
  { id: "av-09", name: "Meera Iyer", image_url: "/avatars/placeholder.svg", ethnicity: "Tamil Female", preview_video: null },
  { id: "av-10", name: "Rohan Das", image_url: "/avatars/placeholder.svg", ethnicity: "Bengali Male", preview_video: null },
  { id: "av-11", name: "Ishita Kapoor", image_url: "/avatars/placeholder.svg", ethnicity: "Kashmiri Female", preview_video: null },
  { id: "av-12", name: "Karthik Subramanian", image_url: "/avatars/placeholder.svg", ethnicity: "Kannada Male", preview_video: null },
  { id: "av-13", name: "Diya Gupta", image_url: "/avatars/placeholder.svg", ethnicity: "Marathi Female", preview_video: null },
  { id: "av-14", name: "Sanjay Thakur", image_url: "/avatars/placeholder.svg", ethnicity: "Rajasthani Male", preview_video: null },
  { id: "av-15", name: "Roshni Malhotra", image_url: "/avatars/placeholder.svg", ethnicity: "Delhi Female", preview_video: null },
  { id: "av-16", name: "Nikhil Joshi", image_url: "/avatars/placeholder.svg", ethnicity: "Maharashtrian Male", preview_video: null },
  { id: "av-17", name: "Tanvi Choudhary", image_url: "/avatars/placeholder.svg", ethnicity: "Assamese Female", preview_video: null },
  { id: "av-18", name: "Deepak Rana", image_url: "/avatars/placeholder.svg", ethnicity: "Himachali Male", preview_video: null },
  { id: "av-19", name: "Simran Kaur", image_url: "/avatars/placeholder.svg", ethnicity: "Sikh Female", preview_video: null },
  { id: "av-20", name: "Amit Saxena", image_url: "/avatars/placeholder.svg", ethnicity: "UP Male", preview_video: null },
];

export const mockVoices = [
  { id: "voice-01", name: "Mumbai Female", provider_voice_id: "21m00Tcm4TlvDq8ikWAM", accent: "Mumbai English" },
  { id: "voice-02", name: "Mumbai Male", provider_voice_id: "29vD33N1CtxCmqQRPOHJ", accent: "Mumbai English" },
  { id: "voice-03", name: "Delhi Female", provider_voice_id: "EXAVITQu4vr4xnSDxMaL", accent: "Delhi English" },
  { id: "voice-04", name: "Delhi Male", provider_voice_id: "ErXwobaYiN019PkySvjV", accent: "Delhi English" },
  { id: "voice-05", name: "Bangalore Female", provider_voice_id: "MF3mGyEYCl7XYWbV9V6O", accent: "Bangalore English" },
  { id: "voice-06", name: "Hyderabad Male", provider_voice_id: "TxGEqnHWrfWFTfGW9XjX", accent: "Hyderabad English" },
  { id: "voice-07", name: "Chennai Female", provider_voice_id: "XB0fDUnXU5powFXDhCwa", accent: "Chennai English" },
  { id: "voice-08", name: "Kolkata Male", provider_voice_id: "pNInz6obpgDQGcFmaJgB", accent: "Kolkata English" },
  { id: "voice-09", name: "Pune Female", provider_voice_id: "yoZ06aMxZJJ28mfd3POQ", accent: "Pune English" },
  { id: "voice-10", name: "Jaipur Male", provider_voice_id: "onwK4e9ZLuTAKqWW03F9", accent: "Jaipur English" },
];

export const mockVideos = [
  {
    id: "vid-001",
    user_id: "mock-user-001",
    script: "Try our new vitamin C serum – glowing skin in just 7 days! Click the link in bio to shop now. Limited offer for first 100 customers!",
    avatar_url: "/avatars/placeholder.svg",
    voice_id: "voice-01",
    status: "ready",
    video_url: "/videos/sample.mp4",
    created_at: "2025-01-20T14:30:00Z",
    thumbnail: null,
  },
  {
    id: "vid-002",
    user_id: "mock-user-001",
    script: "This changed my morning routine completely. Best protein powder for Indian diet. Use code THUMB20 for 20% off!",
    avatar_url: "/avatars/placeholder.svg",
    voice_id: "voice-03",
    status: "ready",
    video_url: "/videos/sample.mp4",
    created_at: "2025-01-19T09:15:00Z",
    thumbnail: null,
  },
  {
    id: "vid-003",
    user_id: "mock-user-001",
    script: "5 skincare secrets every Indian woman should know. Watch till the end for a surprise!",
    avatar_url: "/avatars/placeholder.svg",
    voice_id: "voice-05",
    status: "generating",
    video_url: null,
    created_at: "2025-01-21T16:45:00Z",
    thumbnail: null,
  },
  {
    id: "vid-004",
    user_id: "mock-user-001",
    script: "Unboxing the most viral product of 2025! 🔥 Is it worth the hype?",
    avatar_url: "/avatars/placeholder.svg",
    voice_id: "voice-02",
    status: "queued",
    video_url: null,
    created_at: "2025-01-21T17:00:00Z",
    thumbnail: null,
  },
];

export const mockTestimonials = [
  {
    name: "Ritika Agarwal",
    role: "Skincare Brand Owner",
    avatar: "RA",
    content: "Thumb AI saved me ₹50,000/month on UGC creators. I generate 10 Reels a day now – my engagement is through the roof!",
    rating: 5,
  },
  {
    name: "Kunal Mehta",
    role: "D2C Founder",
    avatar: "KM",
    content: "The Indian accent voices are so natural, my customers think it's a real person. Absolutely game-changing for our ads.",
    rating: 5,
  },
  {
    name: "Neha Bansal",
    role: "Instagram Influencer",
    avatar: "NB",
    content: "I create product review videos in 60 seconds flat. My brand deals doubled after using Thumb AI.",
    rating: 5,
  },
  {
    name: "Arjun Sinha",
    role: "eCommerce Seller",
    avatar: "AS",
    content: "From script to Reel in under 2 minutes. The lip-sync quality is incredible. Best tool for Indian creators.",
    rating: 4,
  },
  {
    name: "Priya Krishnan",
    role: "Marketing Manager",
    avatar: "PK",
    content: "We replaced our entire UGC workflow with Thumb AI. 10x faster, 5x cheaper. The ROI is insane.",
    rating: 5,
  },
];
