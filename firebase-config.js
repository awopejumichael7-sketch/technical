// Load Firebase compat modules so the namespaced API keeps working.
import "https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js";
import "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js";
import "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js";

const firebase = window.firebase;

const firebaseConfig = {
  apiKey: "AIzaSyATTAIic4lYXJvv5Eq4Fd2UG9I6MJumLCU",
  authDomain: "media-54712.firebaseapp.com",
  projectId: "media-54712",
  storageBucket: "media-54712.firebasestorage.app",
  messagingSenderId: "754622637515",
  appId: "1:754622637515:web:6cacb74bbce5036121424e"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const serverTs = () => firebase.firestore.FieldValue.serverTimestamp();

// ---------- helpers ----------
function showAlert(message, type = "success") {
  const el = document.createElement("div");
  el.className = `alert alert-${type}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

async function guarded(label, fn, fallback) {
  try {
    return await fn();
  } catch (e) {
    console.error(label, e);
    const msg = e && e.code === "permission-denied"
      ? "You do not have permission for this action. Please log in as admin."
      : (e && e.message) || "Unknown error";
    showAlert(`${label}: ${msg}`, "error");
    return fallback;
  }
}

const mapDocs = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

// ---------- generic CRUD service ----------
class CrudService {
  constructor(name, labels = {}) {
    this.name = name;
    this.labels = labels; // {add, update, remove} success messages
  }
  get col() { return db.collection(this.name); }

  add(data, extra = {}) {
    return guarded(`Error saving ${this.name}`, async () => {
      const ref = await this.col.add({ ...data, ...extra, createdAt: serverTs(), updatedAt: serverTs() });
      if (this.labels.add) showAlert(this.labels.add);
      return ref.id;
    }, null);
  }
  set(id, data) {
    return guarded(`Error saving ${this.name}`, async () => {
      await this.col.doc(id).set({ ...data, updatedAt: serverTs() });
      return true;
    }, false);
  }
  update(id, data, silent = false) {
    return guarded(`Error updating ${this.name}`, async () => {
      await this.col.doc(id).update({ ...data, updatedAt: serverTs() });
      if (!silent && this.labels.update) showAlert(this.labels.update);
      return true;
    }, false);
  }
  remove(id) {
    return guarded(`Error deleting ${this.name}`, async () => {
      await this.col.doc(id).delete();
      if (this.labels.remove) showAlert(this.labels.remove);
      return true;
    }, false);
  }
  async getAll() {
    return guarded(`Error loading ${this.name}`, async () => mapDocs(await this.col.get()), []);
  }
  // Realtime listener. Sorting is done client-side so documents missing a field are never dropped.
  listen(callback, onError) {
    return this.col.onSnapshot(
      (snap) => callback(mapDocs(snap)),
      (err) => { console.error(`Listener ${this.name}:`, err); if (onError) onError(err); }
    );
  }
}

window.firebase = firebase;
window.db = db;
window.fieldDelete = () => firebase.firestore.FieldValue.delete();
window.showAlert = showAlert;
window.svc = {
  members: new CrudService("members", { add: "Member added", update: "Member updated", remove: "Member deleted" }),
  contacts: new CrudService("contacts", {}),                       // WhatsApp numbers – admin-only
  attendance: new CrudService("attendance", { add: "Attendance recorded", remove: "Attendance record deleted" }),
  roster: new CrudService("roster", { update: "Roster updated" }),
  evaluations: new CrudService("evaluations", { add: "Saved", remove: "Entry deleted" }),
  requests: new CrudService("requests", { add: "Request submitted", update: "Request updated", remove: "Request deleted" }),
  helpdesk: new CrudService("helpdesk", { add: "Submitted to Help Desk", update: "Help Desk ticket updated", remove: "Ticket deleted" })
};

// ---------- authentication (replaces the old hard-coded admin password) ----------
window.authService = {
  login: (email, password) => auth.signInWithEmailAndPassword(email, password),
  logout: () => auth.signOut(),
  onChange: (cb) => auth.onAuthStateChanged(cb),
  currentUser: () => auth.currentUser,
  getToken: async () => (auth.currentUser ? auth.currentUser.getIdToken() : "")
};
