import { auth, db } from './firebase-config.js';
import { initMedicalModule } from './medical.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut,
    updateProfile 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    doc, setDoc, getDoc, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const loadingView = document.getElementById('loading-view');
const authView = document.getElementById('auth-view');
const dashboardView = document.getElementById('dashboard-view');
const logoutBtn = document.getElementById('logout-btn');

const tabLogin = document.getElementById('tab-login');
const tabSignup = document.getElementById('tab-signup');
const nameField = document.getElementById('name-field');
const authForm = document.getElementById('auth-form');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authError = document.getElementById('auth-error');

let isSignupMode = false;
let currentWorkspaceId = null;
let medicalInitialized = false;

tabLogin.addEventListener('click', () => {
    isSignupMode = false;
    nameField.classList.add('hidden');
    authSubmitBtn.textContent = "লগইন করুন";
    authError.classList.add('hidden');
});

tabSignup.addEventListener('click', () => {
    isSignupMode = true;
    nameField.classList.remove('hidden');
    authSubmitBtn.textContent = "অ্যাকাউন্ট তৈরি করুন";
    authError.classList.add('hidden');
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const name = document.getElementById('auth-name').value.trim();
    
    authError.classList.add('hidden');
    authSubmitBtn.disabled = true;
    authSubmitBtn.textContent = "অপেক্ষা করুন...";

    try {
        if (isSignupMode) {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            if (name) await updateProfile(cred.user, { displayName: name });
            await initializeUserWorkspace(cred.user, name || "User");
        } else {
            await signInWithEmailAndPassword(auth, email, password);
        }
    } catch (error) {
        authError.textContent = "ত্রুটি: " + error.message;
        authError.classList.remove('hidden');
    } finally {
        authSubmitBtn.disabled = false;
        authSubmitBtn.textContent = isSignupMode ? "অ্যাকাউন্ট তৈরি করুন" : "লগইন করুন";
    }
});

logoutBtn.addEventListener('click', () => signOut(auth));

async function initializeUserWorkspace(user, displayName) {
    const wsRef = doc(db, "workspaces", user.uid);
    const wsSnap = await getDoc(wsRef);

    if (!wsSnap.exists()) {
        await setDoc(wsRef, {
            workspaceId: user.uid,
            ownerId: user.uid,
            ownerName: displayName,
            type: "Personal_Family",
            createdAt: serverTimestamp()
        });

        await addDoc(collection(db, `workspaces/${user.uid}/family_members`), {
            name: displayName,
            relation: "Self",
            age: "",
            bloodGroup: "",
            createdAt: serverTimestamp()
        });
    }
}

onAuthStateChanged(auth, async (user) => {
    loadingView.classList.add('hidden');
    if (user) {
        currentWorkspaceId = user.uid;
        await initializeUserWorkspace(user, user.displayName || "ব্যবহারকারী");
        
        authView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
        logoutBtn.classList.remove('hidden');

        document.getElementById('user-greeting').textContent = `আসসালামু আলাইকুম, ${user.displayName || 'স্বাগতম'}!`;
        document.getElementById('workspace-id-display').textContent = `Workspace ID: ${user.uid.slice(0, 8)}...`;

        loadFamilyMembers(currentWorkspaceId);
        if (!medicalInitialized) {
            initMedicalModule(currentWorkspaceId);
            medicalInitialized = true;
        }
    } else {
        currentWorkspaceId = null;
        dashboardView.classList.add('hidden');
        document.getElementById('medical-view')?.classList.add('hidden');
        logoutBtn.classList.add('hidden');
        authView.classList.remove('hidden');
    }
});

const memberModal = document.getElementById('member-modal');
document.getElementById('add-member-btn').addEventListener('click', () => memberModal.classList.remove('hidden'));
document.getElementById('close-member-modal').addEventListener('click', () => memberModal.classList.add('hidden'));

document.getElementById('member-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentWorkspaceId) return;

    const name = document.getElementById('member-name').value.trim();
    const relation = document.getElementById('member-relation').value;
    const age = document.getElementById('member-age').value;
    const bloodGroup = document.getElementById('member-blood').value;

    await addDoc(collection(db, `workspaces/${currentWorkspaceId}/family_members`), {
        name, relation, age, bloodGroup, createdAt: serverTimestamp()
    });

    e.target.reset();
    memberModal.classList.add('hidden');
});

function loadFamilyMembers(wsId) {
    const q = query(collection(db, `workspaces/${wsId}/family_members`), orderBy("createdAt", "asc"));
    onSnapshot(q, (snapshot) => {
        const listEl = document.getElementById('family-members-list');
        listEl.innerHTML = "";
        snapshot.forEach((docSnap) => {
            const m = docSnap.data();
            const card = document.createElement('div');
            card.innerHTML = `
                <div style="width:34px;height:34px;border-radius:50%;background:#e0e7ff;color:#4338ca;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    ${m.name.charAt(0)}
                </div>
                <div style="overflow:hidden;">
                    <h4 style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${m.name}</h4>
                    <p style="font-size:11px;color:#64748b;">${m.relation} ${m.bloodGroup ? '• ' + m.bloodGroup : ''}</p>
                </div>
            `;
            listEl.appendChild(card);
        });
    });
}
