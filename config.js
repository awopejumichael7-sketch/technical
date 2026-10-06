// ============================================================
// Freely Given Media Team – application settings
// ============================================================
window.APP_CONFIG = {
  TEAM_NAME: "Freely Given Media Team",

  // Paste the "Web app" URL you get after deploying apps-script/Code.gs
  // (see SETUP.md, step 2). Example: https://script.google.com/macros/s/AKfy.../exec
  // Until this is set, photo uploads are disabled and the app tells the user why.
  DRIVE_API_URL: "https://script.google.com/macros/s/AKfycbx0dRDWPns2IP5vfx3MVvVLj86JpwB4xY45Ch_mczAOVPXLvMgx5lTk0tWuHOm_9KR8/exec",

  // Used to turn local numbers (0803…) into WhatsApp international format.
  DEFAULT_COUNTRY_CODE: "234",

  // Client-side image compression before upload (keeps Drive uploads fast on mobile data)
  GALLERY_MAX_PX: 1800,
  AVATAR_MAX_PX: 600,
  MAX_UPLOAD_MB: 8
};
