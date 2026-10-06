// ============================================================
// Google Drive storage layer (via the Apps Script web app in /apps-script)
// Drive is the single source of truth for every uploaded picture:
//   Gallery-Videography | Gallery-Photography | Gallery-SRT | Gallery-General | Members | HelpDesk
// ============================================================
(function () {
  const cfg = () => window.APP_CONFIG;

  function ensureEnabled() {
    if (!cfg().DRIVE_API_URL) {
      throw new Error("Google Drive is not connected yet. Set DRIVE_API_URL in config.js (see SETUP.md).");
    }
  }

  async function parse(res) {
    let json;
    try { json = await res.json(); } catch (_) { throw new Error("Unexpected response from Google Drive service."); }
    if (!json.ok) throw new Error(json.error || "Google Drive request failed.");
    return json;
  }

  // Resize + re-encode as JPEG so uploads are small and phone-friendly.
  function compressImage(file, maxPx) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith("image/")) return reject(new Error("Please choose an image file."));
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85).split(",")[1]);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read that image.")); };
      img.src = url;
    });
  }

  const DriveService = {
    get enabled() { return !!cfg().DRIVE_API_URL; },

    thumb(id, size = 600) {
      return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${size}`;
    },
    viewUrl(id) {
      return `https://drive.google.com/file/d/${encodeURIComponent(id)}/view`;
    },

    // folder: one of the folder names above, or "GALLERY" for all gallery albums.
    async list(folder) {
      ensureEnabled();
      const res = await fetch(`${cfg().DRIVE_API_URL}?action=list&folder=${encodeURIComponent(folder)}`);
      return (await parse(res)).files;
    },

    // meta: { title, description, uploader }.  idToken is required for the Members folder.
    async upload({ file, folder, meta = {}, maxPx, idToken }) {
      ensureEnabled();
      if (file.size > cfg().MAX_UPLOAD_MB * 1024 * 1024 * 3) throw new Error(`Image is too large (max ${cfg().MAX_UPLOAD_MB}MB after compression).`);
      const data = await compressImage(file, maxPx || cfg().GALLERY_MAX_PX);
      const res = await fetch(cfg().DRIVE_API_URL, {
        method: "POST", // no custom headers => no CORS preflight (Apps Script requirement)
        body: JSON.stringify({ action: "upload", folder, meta, mime: "image/jpeg", data, idToken: idToken || "" })
      });
      return (await parse(res)).file; // { id, ... }
    },

    async remove(fileId, idToken) {
      ensureEnabled();
      const res = await fetch(cfg().DRIVE_API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "delete", fileId, idToken })
      });
      return parse(res);
    }
  };

  window.DriveService = DriveService;
})();
