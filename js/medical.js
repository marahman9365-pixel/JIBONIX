import { db } from './firebase-config.js';
import { 
    collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let activeWorkspaceId = null;
let familyMembersCache = [];
let medicalRecordsCache = [];
let selectedMemberFilter = "ALL";
let compressedImageBase64 = "";

// Initialize Medical Module
export function initMedicalModule(workspaceId) {
    activeWorkspaceId = workspaceId;

    // Navigation Events
    document.getElementById('open-medical-module').addEventListener('click', () => {
        document.getElementById('dashboard-view').classList.add('hidden');
        document.getElementById('medical-view').classList.remove('hidden');
    });

    document.getElementById('back-to-dashboard').addEventListener('click', () => {
        document.getElementById('medical-view').classList.add('hidden');
        document.getElementById('dashboard-view').classList.remove('hidden');
    });

    // Modal Open/Close
    const medModal = document.getElementById('medical-modal');
    document.getElementById('open-add-medical-btn').addEventListener('click', () => {
        populateMemberDropdown();
        document.getElementById('medicine-inputs-list').innerHTML = '';
        addMedicineRow(); // Add one default medicine input row
        compressedImageBase64 = "";
        document.getElementById('rx-preview-box').classList.add('hidden');
        medModal.classList.remove('hidden');
    });

    document.getElementById('close-medical-modal').addEventListener('click', () => {
        medModal.classList.add('hidden');
    });

    // Add More Medicine Row Button
    document.getElementById('add-med-row-btn').addEventListener('click', addMedicineRow);

    // Handle Prescription Image Upload & Auto-Compression (Mobile Camera/Gallery)
    document.getElementById('rx-image-input').addEventListener('change', handleImageCompression);

    // Save Medical Record Form
    document.getElementById('medical-form').addEventListener('submit', saveMedicalRecord);

    // Image Lightbox Close
    document.getElementById('close-lightbox').addEventListener('click', () => {
        document.getElementById('image-lightbox').classList.add('hidden');
    });

    listenFamilyMembers();
    listenMedicalRecords();
}

// Listen to Family Members for Tabs & Dropdown
function listenFamilyMembers() {
    const q = query(collection(db, `workspaces/${activeWorkspaceId}/family_members`), orderBy("createdAt", "asc"));
    onSnapshot(q, (snapshot) => {
        familyMembersCache = [];
        snapshot.forEach(d => familyMembersCache.push({ id: d.id, ...d.data() }));
        renderMemberFilterTabs();
    });
}

function renderMemberFilterTabs() {
    const container = document.getElementById('med-member-tabs');
    container.innerHTML = `<button class="med-tab ${selectedMemberFilter === 'ALL' ? 'active-tab' : ''}" data-id="ALL">সকলের রেকর্ড</button>`;
    
    familyMembersCache.forEach(m => {
        const isActive = selectedMemberFilter === m.id ? 'active-tab' : '';
        container.innerHTML += `<button class="med-tab ${isActive}" data-id="${m.id}">${m.name}</button>`;
    });

    container.querySelectorAll('.med-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedMemberFilter = btn.getAttribute('data-id');
            renderMemberFilterTabs();
            renderMedicalRecords();
        });
    });
}

function populateMemberDropdown() {
    const select = document.getElementById('med-patient-select');
    select.innerHTML = '';
    familyMembersCache.forEach(m => {
        select.innerHTML += `<option value="${m.id}" data-name="${m.name}">${m.name} (${m.relation})</option>`;
    });
}

// Dynamic Medicine Row Builder
function addMedicineRow() {
    const list = document.getElementById('medicine-inputs-list');
    const row = document.createElement('div');
    row.className = "med-row-box";
    row.innerHTML = `
        <input type="text" class="med-name" placeholder="ওষুধের নাম (যেমন: Napa Extend)" required>
        <div class="med-row-grid">
            <select class="med-dose">
                <option value="১+০+১ (সকাল-রাত)">১+০+১ (সকাল-রাত)</option>
                <option value="১+১+১ (সকাল-দুপুর-রাত)">১+১+১ (সকাল-দুপুর-রাত)</option>
                <option value="১+০+০ (শুধু সকালে)">১+০+০ (শুধু সকালে)</option>
                <option value="০+০+১ (শুধু রাতে)">০+০+১ (শুধু রাতে)</option>
                <option value="প্রয়োজন হলে (SOS)">প্রয়োজন হলে (SOS)</option>
            </select>
            <select class="med-meal">
                <option value="খাবারের পরে">খাবারের পরে</option>
                <option value="খাবারের আগে">খাবারের আগে</option>
                <option value="যেকোনো সময়">যেকোনো সময়</option>
            </select>
        </div>
        <div class="med-row-bottom">
            <input type="text" class="med-duration" placeholder="কতদিন? (যেমন: ৭ দিন / চলবে)">
            <button type="button" class="remove-med-btn" onclick="this.parentElement.parentElement.remove()">মুছুন</button>
        </div>
    `;
    list.appendChild(row);
}

// Compress Camera/Gallery Photo so it saves fast & works offline in Firestore
function handleImageCompression(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 900;
            const scale = MAX_WIDTH / img.width;
            canvas.width = img.width > MAX_WIDTH ? MAX_WIDTH : img.width;
            canvas.height = img.width > MAX_WIDTH ? img.height * scale : img.height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            compressedImageBase64 = canvas.toDataURL('image/jpeg', 0.65);
            const previewImg = document.getElementById('rx-preview-img');
            previewImg.src = compressedImageBase64;
            document.getElementById('rx-preview-box').classList.remove('hidden');
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

// Save Record to Firestore
async function saveMedicalRecord(e) {
    e.preventDefault();
    const saveBtn = document.getElementById('save-medical-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = "সেভ হচ্ছে...";

    try {
        const patientSelect = document.getElementById('med-patient-select');
        const memberId = patientSelect.value;
        const memberName = patientSelect.options[patientSelect.selectedIndex]?.getAttribute('data-name') || "সদস্য";

        // Collect all medicines
        const medicines = [];
        document.querySelectorAll('.med-row-box').forEach(row => {
            const name = row.querySelector('.med-name').value.trim();
            if (name) {
                medicines.push({
                    name,
                    dose: row.querySelector('.med-dose').value,
                    meal: row.querySelector('.med-meal').value,
                    duration: row.querySelector('.med-duration').value.trim()
                });
            }
        });

        await addDoc(collection(db, `workspaces/${activeWorkspaceId}/medical_records`), {
            memberId,
            memberName,
            doctorName: document.getElementById('med-doctor-name').value.trim(),
            specialty: document.getElementById('med-specialty').value.trim(),
            hospital: document.getElementById('med-hospital').value.trim(),
            visitDate: document.getElementById('med-visit-date').value,
            nextVisitDate: document.getElementById('med-next-date').value,
            disease: document.getElementById('med-disease').value.trim(),
            advice: document.getElementById('med-advice').value.trim(),
            medicines,
            prescriptionImage: compressedImageBase64,
            createdAt: serverTimestamp()
        });

        e.target.reset();
        document.getElementById('medical-modal').classList.add('hidden');
    } catch (err) {
        alert("সেভ করতে সমস্যা হয়েছে: " + err.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "প্রেসক্রিপশন সেভ করুন";
    }
}

// Listen & Render Medical Records
function listenMedicalRecords() {
    const q = query(collection(db, `workspaces/${activeWorkspaceId}/medical_records`), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        medicalRecordsCache = [];
        snapshot.forEach(d => medicalRecordsCache.push({ id: d.id, ...d.data() }));
        renderMedicalRecords();
    });
}

function renderMedicalRecords() {
    const listContainer = document.getElementById('medical-records-list');
    const filtered = selectedMemberFilter === "ALL" 
        ? medicalRecordsCache 
        : medicalRecordsCache.filter(r => r.memberId === selectedMemberFilter);

    if (filtered.length === 0) {
        listContainer.innerHTML = `<div class="empty-box">কোনো ডাক্তারের পরামর্শ বা প্রেসক্রিপশন পাওয়া যায়নি। উপরে "+ নতুন প্রেসক্রিপশন" বাটনে চাপ দিয়ে যোগ করুন।</div>`;
        return;
    }

    listContainer.innerHTML = "";
    filtered.forEach(rec => {
        let medHtml = "";
        if (rec.medicines && rec.medicines.length > 0) {
            medHtml = `<div class="rx-med-list"><strong>💊 ওষুধের তালিকা:</strong><ul>` + 
                rec.medicines.map(m => `<li><b>${m.name}</b> — ${m.dose} (${m.meal}) ${m.duration ? `[${m.duration}]` : ''}</li>`).join('') +
                `</ul></div>`;
        }

        const imgBtnHtml = rec.prescriptionImage 
            ? `<button class="view-rx-btn" data-img="${rec.prescriptionImage}">📄 প্রেসক্রিপশনের ছবি দেখুন</button>` 
            : '';

        const nextDateBadge = rec.nextVisitDate 
            ? `<span class="next-visit-badge">🗓️ পরবর্তী ভিজিট: ${rec.nextVisitDate}</span>` 
            : '';

        const card = document.createElement('div');
        card.className = "rx-card";
        card.innerHTML = `
            <div class="rx-card-header">
                <div>
                    <span class="patient-tag">👤 ${rec.memberName}</span>
                    <h4>👨‍⚕️ ${rec.doctorName} ${rec.specialty ? `<small>(${rec.specialty})</small>` : ''}</h4>
                    ${rec.hospital ? `<p class="rx-sub">🏥 ${rec.hospital}</p>` : ''}
                </div>
                <button class="del-rx-btn" data-id="${rec.id}" title="মুছে ফেলুন">🗑️</button>
            </div>
            <div class="rx-meta">
                ${rec.visitDate ? `<span>📅 দেখানোর তারিখ: ${rec.visitDate}</span>` : ''}
                ${nextDateBadge}
            </div>
            ${rec.disease ? `<div class="rx-disease">🩺 <b>রোগ/সমস্যা:</b> ${rec.disease}</div>` : ''}
            ${rec.advice ? `<div class="rx-advice">📝 <b>ডাক্তারের পরামর্শ:</b> ${rec.advice}</div>` : ''}
            ${medHtml}
            <div class="rx-actions">${imgBtnHtml}</div>
        `;
        listContainer.appendChild(card);
    });

    // Attach Image View & Delete Events
    listContainer.querySelectorAll('.view-rx-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('lightbox-img').src = btn.getAttribute('data-img');
            document.getElementById('image-lightbox').classList.remove('hidden');
        });
    });

    listContainer.querySelectorAll('.del-rx-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (confirm("আপনি কি নিশ্চিতভাবে এই প্রেসক্রিপশন রেকর্ডটি মুছে ফেলতে চান?")) {
                await deleteDoc(doc(db, `workspaces/${activeWorkspaceId}/medical_records`, btn.getAttribute('data-id')));
            }
        });
    });
}
