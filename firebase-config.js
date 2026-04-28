// Load Firebase compat modules so the existing namespaced API keeps working.
import "https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js";
import "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js";
import "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js";
import "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage-compat.js";

const firebase = window.firebase;

// Firebase Configuration
// Initialize Firebase and set up CRUD operations

const firebaseConfig = {
    apiKey: "AIzaSyAv_4jC5rP71JwH4qPQ5ob2BANQq0AX31w",
  authDomain: "media-54712.firebaseapp.com",
  projectId: "media-54712",
  storageBucket: "media-54712.firebasestorage.app",
  messagingSenderId: "754622637515",
  appId: "1:754622637515:web:6cacb74bbce5036121424e"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

// ==========================================
// MEMBERS CRUD OPERATIONS
// ==========================================

class MembersService {
    constructor() {
        this.collection = "members";
    }

    // CREATE - Add a new member
    async addMember(memberData) {
        try {
            const docRef = await db.collection(this.collection).add({
                ...memberData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showAlert(`Member added successfully with ID: ${docRef.id}`, 'success');
            return docRef.id;
        } catch (error) {
            showAlert(`Error adding member: ${error.message}`, 'error');
            console.error("Error adding member:", error);
            return null;
        }
    }

    // READ - Get all members
    async getAllMembers() {
        try {
            const snapshot = await db.collection(this.collection).get();
            const members = [];
            snapshot.forEach(doc => {
                members.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            return members;
        } catch (error) {
            showAlert(`Error fetching members: ${error.message}`, 'error');
            console.error("Error fetching members:", error);
            return [];
        }
    }

    // READ - Get single member
    async getMemberById(memberId) {
        try {
            const doc = await db.collection(this.collection).doc(memberId).get();
            if (doc.exists) {
                return {
                    id: doc.id,
                    ...doc.data()
                };
            } else {
                showAlert("Member not found", 'error');
                return null;
            }
        } catch (error) {
            showAlert(`Error fetching member: ${error.message}`, 'error');
            console.error("Error fetching member:", error);
            return null;
        }
    }

    // UPDATE - Update member data
    async updateMember(memberId, memberData) {
        try {
            await db.collection(this.collection).doc(memberId).update({
                ...memberData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showAlert("Member updated successfully", 'success');
            return true;
        } catch (error) {
            showAlert(`Error updating member: ${error.message}`, 'error');
            console.error("Error updating member:", error);
            return false;
        }
    }

    // DELETE - Remove a member
    async deleteMember(memberId) {
        try {
            await db.collection(this.collection).doc(memberId).delete();
            showAlert("Member deleted successfully", 'success');
            return true;
        } catch (error) {
            showAlert(`Error deleting member: ${error.message}`, 'error');
            console.error("Error deleting member:", error);
            return false;
        }
    }

    // SEARCH - Search members by name or role
    async searchMembers(searchTerm, role = null) {
        try {
            let query = db.collection(this.collection);
            
            if (role) {
                query = query.where("role", "==", role);
            }
            
            const snapshot = await query.get();
            const results = [];
            
            snapshot.forEach(doc => {
                const member = { id: doc.id, ...doc.data() };
                if (searchTerm === "" || 
                    member.name?.toLowerCase().includes(searchTerm.toLowerCase())) {
                    results.push(member);
                }
            });
            
            return results;
        } catch (error) {
            showAlert(`Error searching members: ${error.message}`, 'error');
            console.error("Error searching members:", error);
            return [];
        }
    }
}

// ==========================================
// ATTENDANCE CRUD OPERATIONS
// ==========================================

class AttendanceService {
    constructor() {
        this.collection = "attendance";
    }

    // CREATE - Record attendance
    async recordAttendance(attendanceData) {
        try {
            const docRef = await db.collection(this.collection).add({
                ...attendanceData,
                date: firebase.firestore.FieldValue.serverTimestamp(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showAlert("Attendance recorded successfully", 'success');
            return docRef.id;
        } catch (error) {
            showAlert(`Error recording attendance: ${error.message}`, 'error');
            console.error("Error recording attendance:", error);
            return null;
        }
    }

    // READ - Get all attendance records
    async getAllAttendance() {
        try {
            const snapshot = await db.collection(this.collection)
                .orderBy("date", "desc")
                .get();
            const records = [];
            snapshot.forEach(doc => {
                records.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            return records;
        } catch (error) {
            showAlert(`Error fetching attendance: ${error.message}`, 'error');
            console.error("Error fetching attendance:", error);
            return [];
        }
    }

    // READ - Get attendance by member
    async getAttendanceByMember(memberId) {
        try {
            const snapshot = await db.collection(this.collection)
                .where("memberId", "==", memberId)
                .orderBy("date", "desc")
                .get();
            const records = [];
            snapshot.forEach(doc => {
                records.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            return records;
        } catch (error) {
            showAlert(`Error fetching member attendance: ${error.message}`, 'error');
            console.error("Error fetching member attendance:", error);
            return [];
        }
    }

    // READ - Get attendance by date
    async getAttendanceByDate(startDate, endDate) {
        try {
            const snapshot = await db.collection(this.collection)
                .where("date", ">=", new Date(startDate))
                .where("date", "<=", new Date(endDate))
                .orderBy("date", "desc")
                .get();
            const records = [];
            snapshot.forEach(doc => {
                records.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            return records;
        } catch (error) {
            showAlert(`Error fetching attendance by date: ${error.message}`, 'error');
            console.error("Error fetching attendance by date:", error);
            return [];
        }
    }

    // UPDATE - Update attendance record
    async updateAttendance(attendanceId, attendanceData) {
        try {
            await db.collection(this.collection).doc(attendanceId).update({
                ...attendanceData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showAlert("Attendance updated successfully", 'success');
            return true;
        } catch (error) {
            showAlert(`Error updating attendance: ${error.message}`, 'error');
            console.error("Error updating attendance:", error);
            return false;
        }
    }

    // DELETE - Remove attendance record
    async deleteAttendance(attendanceId) {
        try {
            await db.collection(this.collection).doc(attendanceId).delete();
            showAlert("Attendance record deleted", 'success');
            return true;
        } catch (error) {
            showAlert(`Error deleting attendance: ${error.message}`, 'error');
            console.error("Error deleting attendance:", error);
            return false;
        }
    }
}

// ==========================================
// GALLERY CRUD OPERATIONS
// ==========================================

class GalleryService {
    constructor() {
        this.collection = "gallery";
        this.storageFolder = "gallery_images";
    }

    // CREATE - Add gallery item with image
    async addGalleryItem(itemData, imageFile) {
        try {
            let imageUrl = itemData.imageUrl;
            
            if (imageFile) {
                imageUrl = await this.uploadImage(imageFile);
            }
            
            const docRef = await db.collection(this.collection).add({
                ...itemData,
                imageUrl: imageUrl,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showAlert("Gallery item added successfully", 'success');
            return docRef.id;
        } catch (error) {
            showAlert(`Error adding gallery item: ${error.message}`, 'error');
            console.error("Error adding gallery item:", error);
            return null;
        }
    }

    // Upload image to storage
    async uploadImage(imageFile) {
        try {
            const fileName = `${this.storageFolder}/${Date.now()}_${imageFile.name}`;
            const storageRef = storage.ref(fileName);
            const snapshot = await storageRef.put(imageFile);
            const imageUrl = await snapshot.ref.getDownloadURL();
            return imageUrl;
        } catch (error) {
            showAlert(`Error uploading image: ${error.message}`, 'error');
            console.error("Error uploading image:", error);
            throw error;
        }
    }

    // READ - Get all gallery items
    async getAllGalleryItems() {
        try {
            const snapshot = await db.collection(this.collection)
                .orderBy("createdAt", "desc")
                .get();
            const items = [];
            snapshot.forEach(doc => {
                items.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            return items;
        } catch (error) {
            showAlert(`Error fetching gallery: ${error.message}`, 'error');
            console.error("Error fetching gallery:", error);
            return [];
        }
    }

    // READ - Get single gallery item
    async getGalleryItemById(itemId) {
        try {
            const doc = await db.collection(this.collection).doc(itemId).get();
            if (doc.exists) {
                return {
                    id: doc.id,
                    ...doc.data()
                };
            }
            return null;
        } catch (error) {
            showAlert(`Error fetching gallery item: ${error.message}`, 'error');
            console.error("Error fetching gallery item:", error);
            return null;
        }
    }

    // UPDATE - Update gallery item
    async updateGalleryItem(itemId, itemData) {
        try {
            await db.collection(this.collection).doc(itemId).update({
                ...itemData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showAlert("Gallery item updated successfully", 'success');
            return true;
        } catch (error) {
            showAlert(`Error updating gallery item: ${error.message}`, 'error');
            console.error("Error updating gallery item:", error);
            return false;
        }
    }

    // DELETE - Remove gallery item and image
    async deleteGalleryItem(itemId) {
        try {
            const item = await this.getGalleryItemById(itemId);
            if (item && item.imageUrl) {
                await this.deleteImage(item.imageUrl);
            }
            await db.collection(this.collection).doc(itemId).delete();
            showAlert("Gallery item deleted", 'success');
            return true;
        } catch (error) {
            showAlert(`Error deleting gallery item: ${error.message}`, 'error');
            console.error("Error deleting gallery item:", error);
            return false;
        }
    }

    // Delete image from storage
    async deleteImage(imageUrl) {
        try {
            const storageRef = storage.refFromURL(imageUrl);
            await storageRef.delete();
        } catch (error) {
            console.error("Error deleting image:", error);
        }
    }

    // SEARCH - Search gallery items
    async searchGalleryItems(searchTerm) {
        try {
            const snapshot = await db.collection(this.collection).get();
            const results = [];
            
            snapshot.forEach(doc => {
                const item = { id: doc.id, ...doc.data() };
                if (searchTerm === "" || 
                    item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    item.description?.toLowerCase().includes(searchTerm.toLowerCase())) {
                    results.push(item);
                }
            });
            
            return results;
        } catch (error) {
            showAlert(`Error searching gallery: ${error.message}`, 'error');
            console.error("Error searching gallery:", error);
            return [];
        }
    }
}

// ==========================================
// REQUESTS CRUD OPERATIONS
// ==========================================

class RequestsService {
    constructor() {
        this.collection = "requests";
    }

    // CREATE - Submit new request
    async submitRequest(requestData) {
        try {
            const docRef = await db.collection(this.collection).add({
                ...requestData,
                status: "pending",
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showAlert("Request submitted successfully", 'success');
            return docRef.id;
        } catch (error) {
            showAlert(`Error submitting request: ${error.message}`, 'error');
            console.error("Error submitting request:", error);
            return null;
        }
    }

    // READ - Get all requests
    async getAllRequests() {
        try {
            const snapshot = await db.collection(this.collection)
                .orderBy("createdAt", "desc")
                .get();
            const requests = [];
            snapshot.forEach(doc => {
                requests.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            return requests;
        } catch (error) {
            showAlert(`Error fetching requests: ${error.message}`, 'error');
            console.error("Error fetching requests:", error);
            return [];
        }
    }

    // READ - Get requests by status
    async getRequestsByStatus(status) {
        try {
            const snapshot = await db.collection(this.collection)
                .where("status", "==", status)
                .orderBy("createdAt", "desc")
                .get();
            const requests = [];
            snapshot.forEach(doc => {
                requests.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            return requests;
        } catch (error) {
            showAlert(`Error fetching requests by status: ${error.message}`, 'error');
            console.error("Error fetching requests by status:", error);
            return [];
        }
    }

    // UPDATE - Update request status
    async updateRequestStatus(requestId, status, response = null) {
        try {
            const updateData = {
                status: status,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            if (response) {
                updateData.adminResponse = response;
                updateData.respondedAt = firebase.firestore.FieldValue.serverTimestamp();
            }
            
            await db.collection(this.collection).doc(requestId).update(updateData);
            showAlert("Request status updated", 'success');
            return true;
        } catch (error) {
            showAlert(`Error updating request: ${error.message}`, 'error');
            console.error("Error updating request:", error);
            return false;
        }
    }

    // DELETE - Remove request
    async deleteRequest(requestId) {
        try {
            await db.collection(this.collection).doc(requestId).delete();
            showAlert("Request deleted", 'success');
            return true;
        } catch (error) {
            showAlert(`Error deleting request: ${error.message}`, 'error');
            console.error("Error deleting request:", error);
            return false;
        }
    }
}

// ==========================================
// HELPDESK CRUD OPERATIONS
// ==========================================

class HelpdeskService {
    constructor() {
        this.collection = "helpdesk";
    }

    // CREATE - Submit complaint/issue
    async submitComplaint(complaintData) {
        try {
            const docRef = await db.collection(this.collection).add({
                ...complaintData,
                status: "open",
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showAlert("Complaint submitted successfully", 'success');
            return docRef.id;
        } catch (error) {
            showAlert(`Error submitting complaint: ${error.message}`, 'error');
            console.error("Error submitting complaint:", error);
            return null;
        }
    }

    // READ - Get all complaints
    async getAllComplaints() {
        try {
            const snapshot = await db.collection(this.collection)
                .orderBy("createdAt", "desc")
                .get();
            const complaints = [];
            snapshot.forEach(doc => {
                complaints.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            return complaints;
        } catch (error) {
            showAlert(`Error fetching complaints: ${error.message}`, 'error');
            console.error("Error fetching complaints:", error);
            return [];
        }
    }

    // READ - Get complaints by status
    async getComplaintsByStatus(status) {
        try {
            const snapshot = await db.collection(this.collection)
                .where("status", "==", status)
                .orderBy("createdAt", "desc")
                .get();
            const complaints = [];
            snapshot.forEach(doc => {
                complaints.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            return complaints;
        } catch (error) {
            showAlert(`Error fetching complaints by status: ${error.message}`, 'error');
            console.error("Error fetching complaints by status:", error);
            return [];
        }
    }

    // UPDATE - Update complaint status
    async updateComplaintStatus(complaintId, status, resolution = null) {
        try {
            const updateData = {
                status: status,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            if (resolution) {
                updateData.resolution = resolution;
                updateData.resolvedAt = firebase.firestore.FieldValue.serverTimestamp();
            }
            
            await db.collection(this.collection).doc(complaintId).update(updateData);
            showAlert("Complaint status updated", 'success');
            return true;
        } catch (error) {
            showAlert(`Error updating complaint: ${error.message}`, 'error');
            console.error("Error updating complaint:", error);
            return false;
        }
    }

    // DELETE - Remove complaint
    async deleteComplaint(complaintId) {
        try {
            await db.collection(this.collection).doc(complaintId).delete();
            showAlert("Complaint deleted", 'success');
            return true;
        } catch (error) {
            showAlert(`Error deleting complaint: ${error.message}`, 'error');
            console.error("Error deleting complaint:", error);
            return false;
        }
    }
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

// Initialize services
const membersService = new MembersService();
const attendanceService = new AttendanceService();
const galleryService = new GalleryService();
const requestsService = new RequestsService();
const helpdeskService = new HelpdeskService();

// Show alert notification
function showAlert(message, type = 'success') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 3000);
}

// Real-time listener for members
function onMembersChange(callback) {
    return db.collection("members").onSnapshot(snapshot => {
        const members = [];
        snapshot.forEach(doc => {
            members.push({
                id: doc.id,
                ...doc.data()
            });
        });
        callback(members);
    });
}

// Real-time listener for attendance
function onAttendanceChange(callback) {
    return db.collection("attendance").orderBy("date", "desc").onSnapshot(snapshot => {
        const records = [];
        snapshot.forEach(doc => {
            records.push({
                id: doc.id,
                ...doc.data()
            });
        });
        callback(records);
    });
}

// Real-time listener for gallery
function onGalleryChange(callback) {
    return db.collection("gallery").orderBy("createdAt", "desc").onSnapshot(snapshot => {
        const items = [];
        snapshot.forEach(doc => {
            items.push({
                id: doc.id,
                ...doc.data()
            });
        });
        callback(items);
    });
}

// Real-time listener for requests
function onRequestsChange(callback) {
    return db.collection("requests").orderBy("createdAt", "desc").onSnapshot(snapshot => {
        const requests = [];
        snapshot.forEach(doc => {
            requests.push({
                id: doc.id,
                ...doc.data()
            });
        });
        callback(requests);
    });
}

// Real-time listener for helpdesk
function onHelpdeskChange(callback) {
    return db.collection("helpdesk").orderBy("createdAt", "desc").onSnapshot(snapshot => {
        const complaints = [];
        snapshot.forEach(doc => {
            complaints.push({
                id: doc.id,
                ...doc.data()
            });
        });
        callback(complaints);
    });
}

// Expose services for non-module scripts in index.html.
window.firebase = firebase;
window.db = db;
window.storage = storage;
window.membersService = membersService;
window.attendanceService = attendanceService;
window.galleryService = galleryService;
window.requestsService = requestsService;
window.helpdeskService = helpdeskService;
window.showAlert = showAlert;
window.onMembersChange = onMembersChange;
window.onAttendanceChange = onAttendanceChange;
window.onGalleryChange = onGalleryChange;
window.onRequestsChange = onRequestsChange;
window.onHelpdeskChange = onHelpdeskChange;

