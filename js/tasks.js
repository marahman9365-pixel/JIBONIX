= 'py-3 text-slate-500';
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

        // রুটিনের ক্ষেত্রে সময় অনুযায়ী সাজানো
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

    // পেজ লোড হওয়ার পর বাটনে ইভেন্ট যুক্ত করা
    window.addEventListener('DOMContentLoaded', () => {
        setTimeout(attachTasksTrigger, 600);
    });
    setInterval(attachTasksTrigger, 1500);
})();
