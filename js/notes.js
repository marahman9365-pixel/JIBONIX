(function () {
    const NOTES_MODAL_ID = 'jibonix-notes-workspace';
    const CATEGORIES = ['জরুরি নোট', 'আইডি ও দলিল', 'পারিবারিক তথ্য', 'মাদ্রাসা ও কাজ', 'অন্যান্য'];

    function setupNotesCard() {
        const candidates = document.querySelectorAll('div, button, a');
        candidates.forEach((el) => {
            if (
                el.innerText &&
                (el.innerText.includes('নোটস') || el.innerText.includes('Notes')) &&
                el.children.length > 0 &&
                el.offsetHeight > 50 &&
                el.offsetHeight < 220 &&
                !el.dataset.notesBound
            ) {
                el.dataset.notesBound = 'true';
                el.style.cursor = 'pointer';

                // ড্যাশবোর্ড গ্রিডে কার্ডটিকে সবার প্রথমে (১ম স্থানে) নিয়ে আসা
                if (el.parentElement && el.parentElement.children.length > 1) {
                    el.parentElement.prepend(el);
                }

                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openNotesWorkspace();
                });
            }
        });
    }

    function getUserContext() {
        if (window.firebase && firebase.auth && firebase.firestore) {
            const user = firebase.auth().currentUser;
            if (user) {
                return { uid: user.uid, db: firebase.firestore(), mode: 'compat' };
            }
        }
        return null;
    }

    async function loadNotes() {
        const ctx = getUserContext();
        const localKey = 'jibonix_notes_vault';
        let localData = JSON.parse(localStorage.getItem(localKey) || '[]');

        if (ctx && ctx.mode === 'compat') {
            try {
                const snap = await ctx.db
                    .collection('users')
                    .doc(ctx.uid)
                    .collection('notes')
                    .orderBy('updatedAt', 'desc')
                    .get();
                const cloudData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                localStorage.setItem(localKey, JSON.stringify(cloudData));
                return cloudData;
            } catch (err) {
                console.warn('Notes Firestore fallback:', err);
            }
        }
        return localData;
    }

    async function saveNote(noteData, editId) {
        const ctx = getUserContext();
        const localKey = 'jibonix_notes_vault';
        let localData = JSON.parse(localStorage.getItem(localKey) || '[]');

        if (editId) {
            localData = localData.map((n) => (n.id === editId ? { ...n, ...noteData } : n));
            localStorage.setItem(localKey, JSON.stringify(localData));
            if (ctx && ctx.mode === 'compat' && !editId.startsWith('local_')) {
                await ctx.db.collection('users').doc(ctx.uid).collection('notes').doc(editId).update(noteData);
            }
            return;
        }

        if (ctx && ctx.mode === 'compat') {
            const docRef = await ctx.db.collection('users').doc(ctx.uid).collection('notes').add(noteData);
            noteData.id = docRef.id;
        } else {
            noteData.id = 'local_' + Date.now();
        }

        localData.unshift(noteData);
        localStorage.setItem(localKey, JSON.stringify(localData));
    }

    async function togglePin(id, currentPin) {
        const ctx = getUserContext();
        const localKey = 'jibonix_notes_vault';
        let localData = JSON.parse(localStorage.getItem(localKey) || '[]');
        localData = localData.map((n) => (n.id === id ? { ...n, pinned: !currentPin } : n));
        localStorage.setItem(localKey, JSON.stringify(localData));

        if (ctx && ctx.mode === 'compat' && !id.startsWith('local_')) {
            await ctx.db.collection('users').doc(ctx.uid).collection('notes').doc(id).update({ pinned: !currentPin });
        }
    }

    async function deleteNote(id) {
        const ctx = getUserContext();
        const localKey = 'jibonix_notes_vault';
        let localData = JSON.parse(localStorage.getItem(localKey) || '[]').filter((n) => n.id !== id);
        localStorage.setItem(localKey, JSON.stringify(localData));

        if (ctx && ctx.mode === 'compat' && !id.startsWith('local_')) {
            await ctx.db.collection('users').doc(ctx.uid).collection('notes').doc(id).delete();
        }
    }

    function hideModalOnly() {
        const modal = document.getElementById(NOTES_MODAL_ID);
        if (modal) modal.classList.add('hidden');
    }

    function closeNotesWorkspace() {
        if (window.history.state && window.history.state.jibonixNotesOpen) {
            window.history.back();
        } else {
            hideModalOnly();
        }
    }

    window.addEventListener('popstate', () => {
        const modal = document.getElementById(NOTES_MODAL_ID);
        if (modal && !modal.classList.contains('hidden')) {
            hideModalOnly();
        }
    });

    let selectedCategory = 'সব';
    let searchQuery = '';
    let editingNoteId = null;

    function openNotesWorkspace() {
        let modal = document.getElementById(NOTES_MODAL_ID);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = NOTES_MODAL_ID;
            modal.className = 'fixed inset-0 z-50 bg-slate-50 flex flex-col overflow-hidden font-sans';
            modal.innerHTML = `
                <div class="bg-amber-700 text-white px-4 py-3.5 flex items-center justify-between shadow">
                    <div class="flex items-center gap-2.5">
                        <button id="close-notes-btn" class="p-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-sm font-bold">
                            ← ড্যাশবোর্ড
                        </button>
                        <div>
                            <h2 class="font-bold text-base leading-tight">নোটস ও গুরুত্বপূর্ণ তথ্য</h2>
                            <p class="text-[11px] text-amber-100">Notes Vault & Important Records</p>
                        </div>
                    </div>
                    <button id="toggle-note-form-btn" class="text-xs bg-white text-amber-800 font-bold px-3 py-1.5 rounded-lg shadow">
                        + নতুন নোট
                    </button>
                </div>

                <!-- Search & Category Filter -->
                <div class="p-3 bg-white border-b border-slate-200 space-y-2">
                    <input id="notes-search-input" type="search" placeholder="নোট, আইডি বা তথ্য খুঁজুন..."
                        class="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-600" />
                    <div id="notes-cat-bar" class="flex gap-1.5 overflow-x-auto pb-1 text-xs">
                        ${['সব', ...CATEGORIES]
                            .map(
                                (c) =>
                                    `<button data-cat="${c}" class="note-cat-btn whitespace-nowrap px-3 py-1 rounded-full border ${
                                        c === 'সব'
                                            ? 'bg-amber-700 text-white border-amber-700 font-semibold'
                                            : 'bg-slate-100 text-slate-600 border-slate-200'
                                    }">${c}</button>`
                            )
                            .join('')}
                    </div>
                </div>

                <!-- Add / Edit Form (Collapsible) -->
                <div id="note-editor-box" class="hidden p-4 bg-amber-50/70 border-b border-amber-200 space-y-2.5">
                    <div class="flex gap-2">
                        <input id="note-title-input" type="text" placeholder="শিরোনাম (যেমন: NID / ব্যাংক / জরুরি নোট)..."
                            class="flex-1 border border-slate-300 bg-white rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:border-amber-600" />
                        <select id="note-category-select"
                            class="border border-slate-300 bg-white rounded-xl px-2.5 py-2 text-xs text-slate-700">
                            ${CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join('')}
                        </select>
                    </div>
                    <textarea id="note-body-input" rows="3" placeholder="বিস্তারিত তথ্য বা নম্বর লিখুন..."
                        class="w-full border border-slate-300 bg-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-600"></textarea>
                    <div class="flex items-center justify-between">
                        <label class="flex items-center gap-1.5 text-xs text-slate-700 font-medium cursor-pointer">
                            <input id="note-pin-checkbox" type="checkbox" class="accent-amber-700 w-4 h-4" />
                            উপরে পিন করে রাখুন (Pin)
                        </label>
                        <div class="flex gap-2">
                            <button id="cancel-note-btn" class="text-xs text-slate-600 px-3 py-1.5 rounded-lg border border-slate-300 bg-white">
                                বাতিল
                            </button>
                            <button id="save-note-btn" class="text-xs bg-amber-700 text-white font-bold px-4 py-1.5 rounded-lg shadow">
                                সেভ করুন
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Notes List -->
                <div id="notes-list-container" class="flex-1 overflow-y-auto p-4 space-y-3">
                    <p class="text-center text-slate-400 text-sm py-8">লোড হচ্ছে...</p>
                </div>
            `;
            document.body.appendChild(modal);
            bindNotesEvents();
        }

        if (!window.history.state || !window.history.state.jibonixNotesOpen) {
            window.history.pushState({ jibonixNotesOpen: true }, '', '#notes');
        }

        modal.classList.remove('hidden');
        renderNotesList();
    }

    function bindNotesEvents() {
        document.getElementById('close-notes-btn').onclick = () => closeNotesWorkspace();

        const editorBox = document.getElementById('note-editor-box');
        const toggleBtn = document.getElementById('toggle-note-form-btn');

        toggleBtn.onclick = () => {
            editingNoteId = null;
            document.getElementById('note-title-input').value = '';
            document.getElementById('note-body-input').value = '';
            document.getElementById('note-pin-checkbox').checked = false;
            editorBox.classList.toggle('hidden');
        };

        document.getElementById('cancel-note-btn').onclick = () => {
            editingNoteId = null;
            editorBox.classList.add('hidden');
        };

        document.getElementById('save-note-btn').onclick = async () => {
            const title = document.getElementById('note-title-input').value.trim();
            const body = document.getElementById('note-body-input').value.trim();
            const category = document.getElementById('note-category-select').value;
            const pinned = document.getElementById('note-pin-checkbox').checked;

            if (!title && !body) return;

            await saveNote(
                {
                    title: title || 'শিরোনামহীন নোট',
                    body,
                    category,
                    pinned,
                    updatedAt: Date.now()
                },
                editingNoteId
            );

            editingNoteId = null;
            editorBox.classList.add('hidden');
            renderNotesList();
        };

        document.getElementById('notes-search-input').oninput = (e) => {
            searchQuery = e.target.value.toLowerCase().trim();
            renderNotesList();
        };

        document.querySelectorAll('.note-cat-btn').forEach((btn) => {
            btn.onclick = () => {
                selectedCategory = btn.dataset.cat;
                document.querySelectorAll('.note-cat-btn').forEach((b) => {
                    b.className =
                        b.dataset.cat === selectedCategory
                            ? 'note-cat-btn whitespace-nowrap px-3 py-1 rounded-full border bg-amber-700 text-white border-amber-700 font-semibold'
                            : 'note-cat-btn whitespace-nowrap px-3 py-1 rounded-full border bg-slate-100 text-slate-600 border-slate-200';
                });
                renderNotesList();
            };
        });
    }

    async function renderNotesList() {
        const container = document.getElementById('notes-list-container');
        let notes = await loadNotes();

        if (selectedCategory !== 'সব') {
            notes = notes.filter((n) => n.category === selectedCategory);
        }
        if (searchQuery) {
            notes = notes.filter(
                (n) =>
                    (n.title && n.title.toLowerCase().includes(searchQuery)) ||
                    (n.body && n.body.toLowerCase().includes(searchQuery))
            );
        }

        // পিন করা নোট সবার উপরে রাখা
        notes.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updatedAt || 0) - (a.updatedAt || 0));

        if (!notes.length) {
            container.innerHTML = `
                <div class="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
                    <p class="text-slate-600 text-sm font-medium">কোনো নোট পাওয়া যায়নি</p>
                    <p class="text-xs text-slate-400 mt-1">উপরে "+ নতুন নোট" বাটনে চেপে জরুরি তথ্য লিখে রাখুন</p>
                </div>`;
            return;
        }

        container.innerHTML = notes
            .map(
                (n) => `
                <div class="bg-white p-4 rounded-2xl border ${
                    n.pinned ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200'
                } shadow-sm space-y-2">
                    <div class="flex items-start justify-between gap-2">
                        <div>
                            <span class="inline-block text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold mb-1">
                                ${n.pinned ? '📌 ' : ''}${n.category || 'জরুরি নোট'}
                            </span>
                            <h3 class="text-sm font-bold text-slate-800">${n.title}</h3>
                        </div>
                        <div class="flex items-center gap-1 text-xs">
                            <button data-pin="${n.id}" data-pinned="${!!n.pinned}" class="note-pin px-2 py-1 rounded bg-slate-100 hover:bg-amber-100" title="Pin">
                                ${n.pinned ? 'Unpin' : '📌'}
                            </button>
                            <button data-copy="${encodeURIComponent(n.body || n.title)}" class="note-copy px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700">
                                কপি
                            </button>
                        </div>
                    </div>
                    ${
                        n.body
                            ? `<p class="text-xs text-slate-600 whitespace-pre-line leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">${n.body}</p>`
                            : ''
                    }
                    <div class="flex justify-end gap-3 pt-1 text-[11px]">
                        <button data-edit="${n.id}" class="note-edit text-indigo-600 font-semibold">এডিট</button>
                        <button data-del="${n.id}" class="note-del text-rose-500 font-semibold">মুছুন</button>
                    </div>
                </div>`
            )
            .join('');

        container.querySelectorAll('.note-pin').forEach((btn) => {
            btn.onclick = async () => {
                await togglePin(btn.dataset.pin, btn.dataset.pinned === 'true');
                renderNotesList();
            };
        });

        container.querySelectorAll('.note-copy').forEach((btn) => {
            btn.onclick = () => {
                navigator.clipboard.writeText(decodeURIComponent(btn.dataset.copy));
                btn.innerText = 'কপি হয়েছে ✓';
                setTimeout(() => (btn.innerText = 'কপি'), 1200);
            };
        });

        container.querySelectorAll('.note-edit').forEach((btn) => {
            btn.onclick = async () => {
                const all = await loadNotes();
                const target = all.find((x) => x.id === btn.dataset.edit);
                if (!target) return;
                editingNoteId = target.id;
                document.getElementById('note-title-input').value = target.title || '';
                document.getElementById('note-body-input').value = target.body || '';
                document.getElementById('note-category-select').value = target.category || CATEGORIES[0];
                document.getElementById('note-pin-checkbox').checked = !!target.pinned;
                document.getElementById('note-editor-box').classList.remove('hidden');
            };
        });

        container.querySelectorAll('.note-del').forEach((btn) => {
            btn.onclick = async () => {
                if (confirm('এই নোটটি মুছে ফেলতে চান?')) {
                    await deleteNote(btn.dataset.del);
                    renderNotesList();
                }
            };
        });
    }

    window.addEventListener('DOMContentLoaded', () => {
        setTimeout(setupNotesCard, 500);
    });
    setInterval(setupNotesCard, 1200);
})();
