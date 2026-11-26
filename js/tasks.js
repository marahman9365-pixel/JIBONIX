(function () {
    const TASKS_MODAL_ID = 'jibonix-tasks-workspace';

    function attachTasksTrigger() {
        const cards = document.querySelectorAll('div, button, a');
        cards.forEach((el) => {
            if (
                el.innerText &&
                (el.innerText.includes('কাজ ও রুটিন') || el.innerText.includes('Tasks')) &&
                el.children.length > 0 &&
                el.offsetHeight > 50 &&
                el.offsetHeight < 220 &&
                !el.dataset.tasksBound
            ) {
                el.dataset.tasksBound = 'true';
                el.style.cursor = 'pointer';
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openTasksWorkspace();
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

    async function loadItems(type) {
        const ctx = getUserContext();
        const localKey = `jibonix_${type}`;
        let localData = JSON.parse(localStorage.getItem(localKey) || '[]');

        if (ctx && ctx.mode === 'compat') {
            try {
                const snap = await ctx.db
                    .collection('users')
                    .doc(ctx.uid)
                    .collection(type)
                    .orderBy('createdAt', 'desc')
                    .get();
                const cloudData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                localStorage.setItem(localKey, JSON.stringify(cloudData));
                return cloudData;
            } catch (err) {
                console.warn('Firestore fetch fallback to local:', err);
            }
        }
        return localData;
    }

    async function saveItem(type, item) {
        const ctx = getUserContext();
        const localKey = `jibonix_${type}`;
        let localData = JSON.parse(localStorage.getItem(localKey) || '[]');

        if (ctx && ctx.mode === 'compat') {
            const docRef = await ctx.db
                .collection('users')
                .doc(ctx.uid)
                .collection(type)
                .add(item);
            item.id = docRef.id;
        } else {
            item.id = 'local_' + Date.now();
        }

        localData.unshift(item);
        localStorage.setItem(localKey, JSON.stringify(localData));
        return item;
    }

    async function toggleItem(type, id, currentState) {
        const ctx = getUserContext();
        const localKey = `jibonix_${type}`;
        let localData = JSON.parse(localStorage.getItem(localKey) || '[]');
        localData = localData.map((i) => (i.id === id ? { ...i, done: !currentState } : i));
        localStorage.setItem(localKey, JSON.stringify(localData));

        if (ctx && ctx.mode === 'compat' && !id.startsWith('local_')) {
            await ctx.db
                .collection('users')
                .doc(ctx.uid)
                .collection(type)
                .doc(id)
                .update({ done: !currentState });
        }
    }

    async function deleteItem(type, id) {
        const ctx = getUserContext();
        const localKey = `jibonix_${type}`;
        let localData = JSON.parse(localStorage.getItem(localKey) || '[]').filter((i) => i.id !== id);
        localStorage.setItem(localKey, JSON.stringify(localData));

        if (ctx && ctx.mode === 'compat' && !id.startsWith('local_')) {
            await ctx.db
                .collection('users')
                .doc(ctx.uid)
                .collection(type)
                .doc(id)
                .delete();
        }
    }

    function hideModalOnly() {
        const modal = document.getElementById(TASKS_MODAL_ID);
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    function closeTasksWorkspace() {
        if (window.history.state && window.history.state.jibonixTasksOpen) {
            window.history.back();
        } else {
            hideModalOnly();
        }
    }

    window.addEventListener('popstate', () => {
        const modal = document.getElementById(TASKS_MODAL_ID);
        if (modal && !modal.classList.contains('hidden')) {
            hideModalOnly();
        }
    });

    function openTasksWorkspace() {
        let modal = document.getElementById(TASKS_MODAL_ID);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = TASKS_MODAL_ID;
            modal.className =
                'fixed inset-0 z-50 bg-slate-50 flex flex-col overflow-hidden font-sans';
            modal.innerHTML = `
                <div class="bg-indigo-700 text-white px-4 py-3.5 flex items-center justify-between shadow">
                    <div class="flex items-center gap-2.5">
                        <button id="close-tasks-btn" class="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-bold">
                            ← ড্যাশবোর্ড
                        </button>
                        <div>
                            <h2 class="font-bold text-base leading-tight">কাজ ও দৈনিক রুটিন</h2>
                            <p class="text-[11px] text-indigo-200">Tasks, Routine & Reminders</p>
                        </div>
                    </div>
                    <button id="reset-routine-btn" class="text-xs bg-white/15 px-2.5 py-1.5 rounded-lg hover:bg-white/25">
                        রুটিন রিসেট
                    </button>
                </div>

                <div class="grid grid-cols-2 bg-white border-b border-slate-200 text-sm font-semibold">
                    <button id="tab-tasks" class="py-3 text-indigo-700 border-b-2 border-indigo-700">
                        দৈনন্দিন কাজ (Tasks)
                    </button>
                    <button id="tab-routine" class="py-3 text-slate-500">
                        দৈনিক রুটিন (Routine)
                    </button>
                </div>

                <div class="p-4 bg-white border-b border-slate-200 space-y-2.5">
                    <div class="flex gap-2">
                        <input id="task-title-input" type="text" placeholder="নতুন কাজ বা রুটিন লিখুন (যেমন: IELTS Writing প্র্যাকটিস)..."
                            class="flex-1 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-600" />
                    </div>
                    <div class="flex gap-2 items-center">
                        <input id="task-time-input" type="time"
                            class="border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-700" />
                        <select id="task-priority-input"
                            class="border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 bg-white">
                            <option value="normal">সাধারণ (Normal)</option>
                            <option value="high">জরুরি (High)</option>
                            <option value="low">সুবিধামতো (Low)</option>
                        </select>
                        <button id="add-task-submit"
                            class="ml-auto bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow hover:bg-indigo-800">
                            + যোগ করুন
                        </button>
                    </div>
                </div>

                <div id="tasks-list-container" class="flex-1 overflow-y-auto p-4 space-y-2.5">
                    <p class="text-center text-slate-400 text-sm py-8">লোড হচ্ছে...</p>
                </div>
            `;
            document.body.appendChild(modal);
            bindWorkspaceEvents();
        }

        if (!window.history.state || !window.history.state.jibonixTasksOpen) {
            window.history.pushState({ jibonixTasksOpen: true }, '', '#tasks');
        }

        modal.classList.remove('hidden');
        renderActiveTab();
    }

    let activeTab = 'tasks';

    function bindWorkspaceEvents() {
        document.getElementById('close-tasks-btn').onclick = () => {
            closeTasksWorkspace();
        };

        const tabTasks = document.getElementById('tab-tasks');
        const tabRoutine = document.getElementById('tab-routine');

        tabTasks.onclick = () => {
            activeTab = 'tasks';
            tabTasks.className = 'py-3 text-indigo-700 border-b-2 border-indigo-700';
            tabRoutine.className = 'py-3 text-slate-500';
            renderActiveTab();
        };

        tabRoutine.onclick = () => {
            activeTab = 'routines';
            tabRoutine.className = 'py-3 text-indigo-700 border-b-2 border-indigo-700';
            tabTasks.className = 'py-3 text-slate-500';
            renderActiveTab();
        };

        document.getElementById('add-task-submit').onclick = async () => {
            const titleEl = document.getElementById('task-title-input');
            const timeEl = document.getElementById('task-time-input');
            const prioEl = document.getElementById('task-priority-input');
            const title = titleEl.value.trim();
            if (!title) return;

            const newItem = {
                title,
                time: timeEl.value || '',
                priority: prioEl.value,
                done: false,
                createdAt: Date.now()
            };

            titleEl.value = '';
            timeEl.value = '';
            await saveItem(activeTab, newItem);
            renderActiveTab();
        };

        document.getElementById('reset-routine-btn').onclick = async () => {
            const items = await loadItems('routines');
            for (const item of items) {
                if (item.done) {
                    await toggleItem('routines', item.id, true);
                }
            }
            if (activeTab === 'routines') renderActiveTab();
            alert('আজকের রুটিন নতুন করে শুরু করার জন্য রিসেট করা হয়েছে!');
        };
    }

    async function renderActiveTab() {
        const container = document.getElementById('tasks-list-container');
        const items = await loadItems(activeTab);

        if (!items.length) {
            container.innerHTML = `
                <div class="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
                    <p class="text-slate-500 text-sm font-medium">এখনো কোনো ${activeTab === 'tasks' ? 'কাজ' : 'রুটিন'} যোগ করা হয়নি</p>
                    <p class="text-xs text-slate-400 mt-1">উপরের বক্সে লিখে "+ যোগ করুন" চাপুন</p>
                </div>`;
            return;
        }

        if (activeTab === 'routines') {
            items.sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
        }

        container.innerHTML = items
            .map((item) => {
                const badge =
                    item.priority === 'high'
                        ? '<span class="text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-semibold">জরুরি</span>'
                        : item.priority === 'low'
                        ? '<span class="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">সুবিধামতো</span>'
                        : '';

                return `
                <div class="bg-white p-3.5 rounded-2xl border ${item.done ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200'} shadow-sm flex items-center gap-3">
                    <input type="checkbox" ${item.done ? 'checked' : ''} data-id="${item.id}" data-done="${item.done}"
                        class="task-check w-5 h-5 accent-indigo-700 rounded cursor-pointer" />
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-semibold ${item.done ? 'line-through text-slate-400' : 'text-slate-800'} break-words">
                            ${item.title}
                        </p>
                        <div class="flex items-center gap-2 mt-1">
                            ${item.time ? `<span class="text-[11px] text-indigo-700 font-medium">⏰ ${formatTime12(item.time)}</span>` : ''}
                            ${badge}
                        </div>
                    </div>
                    <button data-del="${item.id}" class="task-del text-xs text-rose-500 hover:bg-rose-50 px-2 py-1 rounded-lg">
                        মুছুন
                    </button>
                </div>`;
            })
            .join('');

        container.querySelectorAll('.task-check').forEach((cb) => {
            cb.onchange = async () => {
                await toggleItem(activeTab, cb.dataset.id, cb.dataset.done === 'true');
                renderActiveTab();
            };
        });

        container.querySelectorAll('.task-del').forEach((btn) => {
            btn.onclick = async () => {
                await deleteItem(activeTab, btn.dataset.del);
                renderActiveTab();
            };
        });
    }

    function formatTime12(time24) {
        if (!time24) return '';
        const [h, m] = time24.split(':').map(Number);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const hour12 = h % 12 || 12;
        return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
    }

    window.addEventListener('DOMContentLoaded', () => {
        setTimeout(attachTasksTrigger, 600);
    });
    setInterval(attachTasksTrigger, 1500);
})();
