// ============================================
// Firebase Configuration & Initialization
// ============================================
const firebaseConfig = {
    // Replace with your Firebase config from Firebase Console
    apiKey: "YOUR_API_KEY",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

// ============================================
// Global State Management
// ============================================
const appState = {
    currentUser: null,
    isAdmin: false,
    currentSection: 'dashboard',
    members: [],
    attendance: [],
    gallery: [],
    requests: [],
    helpdesk: [],
    filteredMembers: [],
    filteredGallery: [],
    theme: localStorage.getItem('theme') || 'light'
};

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    setupTheme();
    setupEventListeners();
    loadDashboardData();
    checkAdminStatus();
}

// ============================================
// Theme Management
// ============================================
function setupTheme() {
    if (appState.theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
}

function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    html.setAttribute('data-theme', newTheme);
    appState.theme = newTheme;
    localStorage.setItem('theme', newTheme);
}

// ============================================
// Event Listeners Setup
// ============================================
function setupEventListeners() {
    // Navigation links
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const section = link.textContent.toLowerCase();
            showSection(section);
        });
    });

    // Theme toggle
    const themeToggle = document.querySelector('.theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    // Admin badge
    const adminBadge = document.getElementById('adminBadge');
    if (adminBadge) {
        adminBadge.addEventListener('click', toggleAdminModal);
    }

    // Modal close buttons
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) closeModal(modal.id);
        });
    });

    // Click outside modal to close
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });
}

// ============================================
// Section Navigation
// ============================================
function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.style.display = 'none';
    });

    // Remove active class from all nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });

    // Show selected section
    const sectionId = `${sectionName}Section`;
    const section = document.getElementById(sectionId);
    if (section) {
        section.style.display = 'block';
    }

    // Set active nav link
    const activeLink = Array.from(document.querySelectorAll('.nav-link'))
        .find(link => link.textContent.toLowerCase() === sectionName.toLowerCase());
    if (activeLink) {
        activeLink.classList.add('active');
    }

    appState.currentSection = sectionName;

    // Load section-specific data
    switch (sectionName.toLowerCase()) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'members':
            loadMembersData();
            break;
        case 'attendance':
            loadAttendanceData();
            break;
        case 'gallery':
            loadGalleryData();
            break;
        case 'requests':
            loadRequestsData();
            break;
        case 'helpdesk':
            loadHelpdeskData();
            break;
    }
}

// ============================================
// Dashboard
// ============================================
async function loadDashboardData() {
    try {
        // Load members count
        const membersSnapshot = await db.collection('members').get();
        const totalMembers = membersSnapshot.size;
        document.getElementById('totalMembers').textContent = totalMembers;

        // Load attendance data for this week
        const weekStart = getWeekStart(new Date());
        const attendanceSnapshot = await db.collection('attendance')
            .where('date', '>=', weekStart)
            .get();

        const presentCount = attendanceSnapshot.docs.filter(
            doc => doc.data().status === 'present'
        ).length;
        const absentCount = attendanceSnapshot.docs.filter(
            doc => doc.data().status === 'absent'
        ).length;

        document.getElementById('presentThisWeek').textContent = presentCount;
        document.getElementById('absentThisWeek').textContent = absentCount;

        const attendancePercentage = totalMembers > 0 
            ? Math.round((presentCount / (presentCount + absentCount)) * 100) 
            : 0;
        document.getElementById('attendancePercentage').textContent = attendancePercentage + '%';

        // Load today's attendance
        loadTodayAttendance();

        // Load next meeting
        loadNextMeeting();

    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showAlert('Error loading dashboard data', 'error');
    }
}

async function loadTodayAttendance() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const attendanceSnapshot = await db.collection('attendance')
            .where('date', '==', today)
            .get();

        const tableBody = document.getElementById('todayAttendanceTable');
        tableBody.innerHTML = '';

        attendanceSnapshot.forEach(doc => {
            const data = doc.data();
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${data.memberName}</td>
                <td>${data.role}</td>
                <td><span class="status-badge status-${data.status}">${data.status}</span></td>
                <td>${data.reason || '-'}</td>
            `;
            tableBody.appendChild(row);
        });

        if (attendanceSnapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-secondary);">No attendance records for today</td></tr>';
        }
    } catch (error) {
        console.error('Error loading today attendance:', error);
    }
}

function loadNextMeeting() {
    // Meeting schedule configuration
    const meetings = {
        0: { day: 'Sunday', time: '08:00 AM' },
        3: { day: 'Wednesday', time: '06:00 PM' },
        6: { day: 'Saturday', time: '02:00 PM' }
    };

    const today = new Date();
    let nextMeeting = null;
    let daysUntil = 0;

    for (let i = 1; i <= 7; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() + i);
        const dayOfWeek = checkDate.getDay();

        if (meetings[dayOfWeek]) {
            nextMeeting = meetings[dayOfWeek];
            daysUntil = i;
            break;
        }
    }

    if (nextMeeting) {
        const meetingText = `${nextMeeting.day} at ${nextMeeting.time}`;
        document.getElementById('nextMeeting').textContent = meetingText;
        
        const progress = Math.max(0, (7 - daysUntil) / 7 * 100);
        document.getElementById('meetingProgress').style.width = progress + '%';
    }
}

// ============================================
// Members
// ============================================
async function loadMembersData() {
    try {
        const snapshot = await db.collection('members').get();
        appState.members = [];

        snapshot.forEach(doc => {
            appState.members.push({ id: doc.id, ...doc.data() });
        });

        appState.filteredMembers = [...appState.members];
        renderMembers(appState.filteredMembers);
    } catch (error) {
        console.error('Error loading members:', error);
        showAlert('Error loading members', 'error');
    }
}

function renderMembers(members) {
    const grid = document.getElementById('membersGrid');
    grid.innerHTML = '';

    if (members.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary);">No members found</p>';
        return;
    }

    members.forEach(member => {
        const attendanceClass = member.attendanceRate >= 80 ? 'high' : 
                               member.attendanceRate >= 50 ? 'medium' : 'low';

        const card = document.createElement('div');
        card.className = 'member-card';
        card.innerHTML = `
            <div class="member-avatar">
                ${member.photoURL ? 
                    `<img src="${member.photoURL}" alt="${member.name}">` : 
                    `<i class="fas fa-user" style="font-size: 3rem; color: var(--accent-gold);"></i>`
                }
            </div>
            <div class="member-info">
                <h3>${member.name}</h3>
                <div class="member-role">${member.role}</div>
                <div class="member-detail"><strong>Phone:</strong> ${member.phone || 'N/A'}</div>
                <div class="member-detail"><strong>Email:</strong> ${member.email || 'N/A'}</div>
                <span class="attendance-badge attendance-${attendanceClass}">
                    ${member.attendanceRate || 0}% Attendance
                </span>
            </div>
            <div class="member-actions">
                <button class="btn-icon" title="Edit" onclick="editMember('${member.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon" title="Delete" onclick="deleteMember('${member.id}')">
                    <i class="fas fa-trash"></i>
                </button>
                <button class="btn-icon" title="View Details" onclick="viewMemberDetails('${member.id}')">
                    <i class="fas fa-eye"></i>
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function filterMembers() {
    const searchTerm = document.getElementById('memberSearch').value.toLowerCase();
    const roleFilter = document.getElementById('roleFilter').value;

    appState.filteredMembers = appState.members.filter(member => {
        const matchesSearch = member.name.toLowerCase().includes(searchTerm);
        const matchesRole = !roleFilter || member.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    renderMembers(appState.filteredMembers);
}

// ============================================
// Attendance
// ============================================
async function loadAttendanceData() {
    try {
        const snapshot = await db.collection('attendance').get();
        appState.attendance = [];

        snapshot.forEach(doc => {
            appState.attendance.push({ id: doc.id, ...doc.data() });
        });

        // Sort by date descending
        appState.attendance.sort((a, b) => b.date - a.date);
        renderAttendanceTable(appState.attendance);
    } catch (error) {
        console.error('Error loading attendance:', error);
        showAlert('Error loading attendance records', 'error');
    }
}

function renderAttendanceTable(records) {
    const tableBody = document.getElementById('attendanceTable');
    tableBody.innerHTML = '';

    if (records.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-secondary);">No attendance records</td></tr>';
        return;
    }

    records.forEach(record => {
        const date = record.date.toDate ? record.date.toDate() : new Date(record.date);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${date.toLocaleDateString()}</td>
            <td>${record.meeting || 'General'}</td>
            <td>${record.memberName}</td>
            <td><span class="status-badge status-${record.status}">${record.status}</span></td>
            <td>${record.reason || '-'}</td>
        `;
        tableBody.appendChild(row);
    });
}

function filterAttendance() {
    const meetingFilter = document.getElementById('attendanceMeetingFilter').value;
    const dateFilter = document.getElementById('attendanceDateFilter').value;

    let filtered = appState.attendance;

    if (meetingFilter !== 'all') {
        filtered = filtered.filter(record => record.meeting === meetingFilter);
    }

    if (dateFilter) {
        const filterDate = new Date(dateFilter);
        filterDate.setHours(0, 0, 0, 0);
        filtered = filtered.filter(record => {
            const recordDate = record.date.toDate ? record.date.toDate() : new Date(record.date);
            recordDate.setHours(0, 0, 0, 0);
            return recordDate.getTime() === filterDate.getTime();
        });
    }

    renderAttendanceTable(filtered);
}

function resetAttendanceFilter() {
    document.getElementById('attendanceMeetingFilter').value = 'all';
    document.getElementById('attendanceDateFilter').value = '';
    renderAttendanceTable(appState.attendance);
}

// ============================================
// Gallery
// ============================================
async function loadGalleryData() {
    try {
        const snapshot = await db.collection('gallery').get();
        appState.gallery = [];

        snapshot.forEach(doc => {
            appState.gallery.push({ id: doc.id, ...doc.data() });
        });

        appState.filteredGallery = [...appState.gallery];
        renderGallery(appState.filteredGallery);
    } catch (error) {
        console.error('Error loading gallery:', error);
        showAlert('Error loading gallery', 'error');
    }
}

function renderGallery(images) {
    const grid = document.getElementById('galleryGrid');
    grid.innerHTML = '';

    if (images.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary);">No photos in gallery</p>';
        return;
    }

    images.forEach((image, index) => {
        const date = image.uploadDate?.toDate ? image.uploadDate.toDate() : new Date();
        const item = document.createElement('div');
        item.className = 'gallery-item';
        item.innerHTML = `
            <img src="${image.url}" alt="${image.title}" class="gallery-image" onclick="openLightbox(${index})">
            <div class="gallery-info">
                <div class="gallery-title">${image.title}</div>
                <div class="gallery-description">${image.description || 'No description'}</div>
                <div class="gallery-date">${date.toLocaleDateString()}</div>
                ${appState.isAdmin ? `
                    <div class="gallery-actions">
                        <button class="btn-icon" onclick="deleteGalleryImage('${image.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
        grid.appendChild(item);
    });
}

function filterGallery() {
    const searchTerm = document.getElementById('gallerySearch').value.toLowerCase();

    appState.filteredGallery = appState.gallery.filter(image => {
        return image.title.toLowerCase().includes(searchTerm) ||
               (image.description && image.description.toLowerCase().includes(searchTerm));
    });

    renderGallery(appState.filteredGallery);
}

function sortGallery() {
    const sortValue = document.getElementById('gallerySort').value;

    switch (sortValue) {
        case 'newest':
            appState.filteredGallery.sort((a, b) => b.uploadDate - a.uploadDate);
            break;
        case 'oldest':
            appState.filteredGallery.sort((a, b) => a.uploadDate - b.uploadDate);
            break;
        case 'az':
            appState.filteredGallery.sort((a, b) => a.title.localeCompare(b.title));
            break;
    }

    renderGallery(appState.filteredGallery);
}

let currentLightboxIndex = 0;

function openLightbox(index) {
    currentLightboxIndex = index;
    const image = appState.filteredGallery[index];
    const modal = document.getElementById('lightboxModal');
    
    if (!modal) {
        createLightboxModal();
    }

    updateLightboxImage(index);
    document.getElementById('lightboxModal').style.display = 'flex';
}

function createLightboxModal() {
    const modal = document.createElement('div');
    modal.id = 'lightboxModal';
    modal.className = 'lightbox-modal';
    modal.innerHTML = `
        <div class="lightbox-content">
            <img id="lightboxImage" class="lightbox-image" src="" alt="">
            <button class="lightbox-close" onclick="closeLightbox()">✕</button>
            <div class="lightbox-nav">
                <button class="lightbox-nav-btn" onclick="previousImage()">‹</button>
                <button class="lightbox-nav-btn" onclick="nextImage()">›</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function updateLightboxImage(index) {
    const image = appState.filteredGallery[index];
    document.getElementById('lightboxImage').src = image.url;
}

function nextImage() {
    if (currentLightboxIndex < appState.filteredGallery.length - 1) {
        currentLightboxIndex++;
        updateLightboxImage(currentLightboxIndex);
    }
}

function previousImage() {
    if (currentLightboxIndex > 0) {
        currentLightboxIndex--;
        updateLightboxImage(currentLightboxIndex);
    }
}

function closeLightbox() {
    const modal = document.getElementById('lightboxModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// ============================================
// Requests
// ============================================
async function loadRequestsData() {
    try {
        const snapshot = await db.collection('requests').get();
        appState.requests = [];

        snapshot.forEach(doc => {
            appState.requests.push({ id: doc.id, ...doc.data() });
        });

        renderRequests(appState.requests);
    } catch (error) {
        console.error('Error loading requests:', error);
        showAlert('Error loading requests', 'error');
    }
}

function renderRequests(requests) {
    const container = document.getElementById('requestsList');
    container.innerHTML = '';

    if (requests.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No requests found</p>';
        return;
    }

    requests.forEach(request => {
        const date = request.createdAt?.toDate ? request.createdAt.toDate() : new Date();
        const card = document.createElement('div');
        card.className = `request-card priority-${request.priority}`;
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start; gap: 1rem;">
                <div>
                    <h3 style="margin-bottom: 0.5rem;">${request.title}</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 0.5rem;">${request.description}</p>
                    <div style="display: flex; gap: 1rem; font-size: 0.9rem;">
                        <span><strong>Requested by:</strong> ${request.submittedBy}</span>
                        <span><strong>Date:</strong> ${date.toLocaleDateString()}</span>
                    </div>
                </div>
                <div>
                    <span class="status-badge status-${request.status}">${request.status}</span>
                </div>
            </div>
            ${appState.isAdmin ? `
                <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
                    <button class="btn-secondary" onclick="updateRequestStatus('${request.id}', 'approved')">Approve</button>
                    <button class="btn-secondary" onclick="updateRequestStatus('${request.id}', 'declined')">Decline</button>
                    <button class="btn-secondary" onclick="updateRequestStatus('${request.id}', 'completed')">Complete</button>
                </div>
            ` : ''}
        `;
        container.appendChild(card);
    });
}

function filterRequests() {
    const statusFilter = document.getElementById('requestStatusFilter').value;
    const urgencyFilter = document.getElementById('requestUrgencyFilter').value;

    let filtered = appState.requests;

    if (statusFilter !== 'all') {
        filtered = filtered.filter(req => req.status === statusFilter);
    }

    if (urgencyFilter !== 'all') {
        filtered = filtered.filter(req => req.priority === urgencyFilter);
    }

    renderRequests(filtered);
}

// ============================================
// Help Desk
// ============================================
async function loadHelpdeskData() {
    try {
        const snapshot = await db.collection('complaints').get();
        appState.helpdesk = [];

        snapshot.forEach(doc => {
            appState.helpdesk.push({ id: doc.id, ...doc.data() });
        });

        renderHelpdesk(appState.helpdesk);
    } catch (error) {
        console.error('Error loading helpdesk:', error);
        showAlert('Error loading helpdesk', 'error');
    }
}

function renderHelpdesk(complaints) {
    const container = document.getElementById('helpdeskList') || createHelpdeskContainer();

    container.innerHTML = '';

    if (complaints.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No complaints submitted</p>';
        return;
    }

    complaints.forEach(complaint => {
        const date = complaint.createdAt?.toDate ? complaint.createdAt.toDate() : new Date();
        const card = document.createElement('div');
        card.className = `request-card priority-${complaint.priority}`;
        card.innerHTML = `
            <div>
                <h3 style="margin-bottom: 0.5rem;">${complaint.subject}</h3>
                <p style="color: var(--text-secondary); margin-bottom: 0.5rem;">${complaint.message}</p>
                <div style="display: flex; gap: 1rem; font-size: 0.9rem;">
                    <span><strong>From:</strong> ${complaint.name}</span>
                    <span><strong>Date:</strong> ${date.toLocaleDateString()}</span>
                </div>
            </div>
            <span class="status-badge status-${complaint.status}">${complaint.status}</span>
            ${appState.isAdmin ? `
                <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
                    <button class="btn-secondary" onclick="updateComplaintStatus('${complaint.id}', 'resolved')">Mark Resolved</button>
                    <button class="btn-secondary" onclick="deleteComplaint('${complaint.id}')">Delete</button>
                </div>
            ` : ''}
        `;
        container.appendChild(card);
    });
}

function createHelpdeskContainer() {
    const container = document.createElement('div');
    container.id = 'helpdeskList';
    document.getElementById('helpdeskSection').appendChild(container);
    return container;
}

// ============================================
// Modal Management
// ============================================
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

function toggleAdminModal() {
    openModal('adminLoginModal');
}

function openUploadModal() {
    openModal('uploadPhotoModal');
}

function openPublicRequestModal() {
    openModal('publicRequestModal');
}

function openPublicComplaintModal() {
    openModal('publicComplaintModal');
}

// ============================================
// Admin Authentication
// ============================================
async function checkAdminStatus() {
    // Check localStorage for admin status (in production, use Firebase Auth)
    const adminToken = localStorage.getItem('adminToken');
    if (adminToken) {
        appState.isAdmin = true;
        updateAdminUI();
    }
}

async function handleAdminLogin(email, password) {
    try {
        // In production, use Firebase Authentication
        // This is a simple example - implement proper authentication
        
        if (email && password) {
            // Simulate admin login
            localStorage.setItem('adminToken', 'admin_token_' + Date.now());
            appState.isAdmin = true;
            appState.currentUser = email;
            
            updateAdminUI();
            closeModal('adminLoginModal');
            showAlert('Admin login successful', 'success');
        }
    } catch (error) {
        console.error('Login error:', error);
        showAlert('Login failed. Please check your credentials.', 'error');
    }
}

function updateAdminUI() {
    const adminBadge = document.getElementById('adminBadge');
    const adminText = document.getElementById('adminText');
    const adminIcon = document.getElementById('adminIcon');

    if (appState.isAdmin) {
        adminBadge.classList.add('logged-in');
        adminText.textContent = appState.currentUser || 'Admin';
        adminIcon.className = 'fas fa-check-circle';
    }
}

function logoutAdmin() {
    localStorage.removeItem('adminToken');
    appState.isAdmin = false;
    appState.currentUser = null;
    
    const adminBadge = document.getElementById('adminBadge');
    const adminText = document.getElementById('adminText');
    const adminIcon = document.getElementById('adminIcon');
    
    adminBadge.classList.remove('logged-in');
    adminText.textContent = 'Admin Login';
    adminIcon.className = 'fas fa-lock';
    
    showAlert('Logged out successfully', 'success');
}

// ============================================
// Data Submission Handlers
// ============================================
async function submitRequest(event) {
    event.preventDefault();
    
    try {
        const formData = new FormData(event.target);
        
        await db.collection('requests').add({
            title: formData.get('title'),
            description: formData.get('description'),
            submittedBy: formData.get('name'),
            email: formData.get('email'),
            priority: formData.get('priority'),
            status: 'pending',
            createdAt: new Date()
        });

        event.target.reset();
        closeModal('publicRequestModal');
        showAlert('Request submitted successfully!', 'success');
        
        if (appState.isAdmin) {
            loadRequestsData();
        }
    } catch (error) {
        console.error('Error submitting request:', error);
        showAlert('Error submitting request', 'error');
    }
}

async function submitComplaint(event) {
    event.preventDefault();
    
    try {
        const formData = new FormData(event.target);
        
        await db.collection('complaints').add({
            subject: formData.get('subject'),
            message: formData.get('message'),
            name: formData.get('name'),
            email: formData.get('email'),
            priority: formData.get('priority') || 'medium',
            status: 'open',
            createdAt: new Date()
        });

        event.target.reset();
        closeModal('publicComplaintModal');
        showAlert('Complaint submitted successfully!', 'success');
        
        if (appState.isAdmin) {
            loadHelpdeskData();
        }
    } catch (error) {
        console.error('Error submitting complaint:', error);
        showAlert('Error submitting complaint', 'error');
    }
}

async function uploadPhoto(event) {
    event.preventDefault();
    
    try {
        const formData = new FormData(event.target);
        const file = formData.get('photo');

        if (!file) {
            showAlert('Please select a photo', 'error');
            return;
        }

        // Show loading state
        const submitBtn = event.target.querySelector('[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Uploading...';

        // Upload to Firebase Storage
        const fileName = `gallery/${Date.now()}_${file.name}`;
        const storageRef = storage.ref(fileName);
        const uploadTask = storageRef.put(file);

        uploadTask.on('state_changed', 
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log('Upload progress:', progress);
            }
        );

        await uploadTask;
        const downloadURL = await storageRef.getDownloadURL();

        // Save to Firestore
        await db.collection('gallery').add({
            title: formData.get('title'),
            description: formData.get('description'),
            url: downloadURL,
            uploadedBy: appState.currentUser || 'Anonymous',
            uploadDate: new Date()
        });

        event.target.reset();
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        
        closeModal('uploadPhotoModal');
        showAlert('Photo uploaded successfully!', 'success');
        loadGalleryData();

    } catch (error) {
        console.error('Error uploading photo:', error);
        showAlert('Error uploading photo: ' + error.message, 'error');
        const submitBtn = event.target.querySelector('[type="submit"]');
        submitBtn.disabled = false;
    }
}

// ============================================
// Admin Actions
// ============================================
async function updateRequestStatus(requestId, newStatus) {
    try {
        await db.collection('requests').doc(requestId).update({
            status: newStatus
        });
        
        showAlert(`Request ${newStatus} successfully`, 'success');
        loadRequestsData();
    } catch (error) {
        console.error('Error updating request:', error);
        showAlert('Error updating request', 'error');
    }
}

async function updateComplaintStatus(complaintId, newStatus) {
    try {
        await db.collection('complaints').doc(complaintId).update({
            status: newStatus
        });
        
        showAlert(`Complaint ${newStatus} successfully`, 'success');
        loadHelpdeskData();
    } catch (error) {
        console.error('Error updating complaint:', error);
        showAlert('Error updating complaint', 'error');
    }
}

async function deleteComplaint(complaintId) {
    if (confirm('Are you sure you want to delete this complaint?')) {
        try {
            await db.collection('complaints').doc(complaintId).delete();
            showAlert('Complaint deleted successfully', 'success');
            loadHelpdeskData();
        } catch (error) {
            console.error('Error deleting complaint:', error);
            showAlert('Error deleting complaint', 'error');
        }
    }
}

async function deleteGalleryImage(imageId) {
    if (confirm('Are you sure you want to delete this photo?')) {
        try {
            await db.collection('gallery').doc(imageId).delete();
            showAlert('Photo deleted successfully', 'success');
            loadGalleryData();
        } catch (error) {
            console.error('Error deleting photo:', error);
            showAlert('Error deleting photo', 'error');
        }
    }
}

async function deleteMember(memberId) {
    if (confirm('Are you sure you want to delete this member?')) {
        try {
            await db.collection('members').doc(memberId).delete();
            showAlert('Member deleted successfully', 'success');
            loadMembersData();
        } catch (error) {
            console.error('Error deleting member:', error);
            showAlert('Error deleting member', 'error');
        }
    }
}

async function editMember(memberId) {
    // Implement edit modal and functionality
    showAlert('Edit functionality coming soon', 'info');
}

async function viewMemberDetails(memberId) {
    // Implement member details modal
    showAlert('View details functionality coming soon', 'info');
}

// ============================================
// Utility Functions
// ============================================
function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
}

function showAlert(message, type = 'success') {
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    document.body.appendChild(alert);

    setTimeout(() => {
        alert.remove();
    }, 4000);
}

// ============================================
// Export functions for HTML onclick handlers
// ============================================
window.showSection = showSection;
window.toggleTheme = toggleTheme;
window.toggleAdminModal = toggleAdminModal;
window.openUploadModal = openUploadModal;
window.openPublicRequestModal = openPublicRequestModal;
window.openPublicComplaintModal = openPublicComplaintModal;
window.filterMembers = filterMembers;
window.filterGallery = filterGallery;
window.sortGallery = sortGallery;
window.filterAttendance = filterAttendance;
window.resetAttendanceFilter = resetAttendanceFilter;
window.filterRequests = filterRequests;
window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;
window.nextImage = nextImage;
window.previousImage = previousImage;
window.submitRequest = submitRequest;
window.submitComplaint = submitComplaint;
window.uploadPhoto = uploadPhoto;
window.handleAdminLogin = handleAdminLogin;
window.logoutAdmin = logoutAdmin;
window.updateRequestStatus = updateRequestStatus;
window.updateComplaintStatus = updateComplaintStatus;
window.deleteComplaint = deleteComplaint;
window.deleteGalleryImage = deleteGalleryImage;
window.deleteMember = deleteMember;
window.editMember = editMember;
window.viewMemberDetails = viewMemberDetails;
