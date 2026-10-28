const $ = s => document.querySelector(s);
const addBox = $(".add-box"), wrapper = $(".wrapper"), popupBox = $(".popup-box"),
    popupTitle = $(".popup header p"), closeIcon = $(".popup header i"),
    titleTag = $("#title"), descTag = $("#desc"), tagsTag = $("#tags"), hintTag = $("#hint"),
    addBtn = $("#saveBtn"), searchTag = $("#search"), sortTag = $("#sort"),
    counter = $("#counter"), emptyTag = $("#empty"), filtersTag = $("#filters"),
    colorBox = $(".colors"), themeBtn = $("#themeBtn"), importFile = $("#importFile"),
    typeBtns = document.querySelectorAll(".types button"),
    descLabel = $(".row.description label");

const months = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
const COLORS = ["#ffffff", "#fef3c7", "#d1fae5", "#dbeafe", "#fce7f3", "#ede9fe"];
const HINT = "Ctrl + Enter to save • Esc to close", TRASH_DAYS = 30;

let notes = loadNotes(), editId = null, selectedColor = COLORS[0], noteType = "text", view = "all";



function loadNotes() {
    try {
        const data = JSON.parse(localStorage.getItem("notes") || "[]").map((n, i) => normalize(n, i));
        const limit = Date.now() - TRASH_DAYS * 864e5;   // auto-purge old trash
        return data.filter(n => !n.trashed || n.deletedAt > limit);
    } catch { return []; }
}
function normalize(n, i = 0) {
    const base = Date.now() + i;
    return {
        id: n.id || base, title: String(n.title || ""), description: String(n.description || ""),
        date: n.date || formatDate(new Date()), ts: n.ts || n.id || base,
        pinned: !!n.pinned, edited: !!n.edited,
        color: COLORS.includes(n.color) ? n.color : COLORS[0],
        type: n.type === "list" ? "list" : "text",
        items: Array.isArray(n.items) ? n.items.map(x => ({ text: String(x.text), done: !!x.done })) : [],
        tags: Array.isArray(n.tags) ? n.tags.map(String) : [],
        trashed: !!n.trashed, deletedAt: n.deletedAt || 0
    };
}
function save() { localStorage.setItem("notes", JSON.stringify(notes)); }
function formatDate(d) { return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; }
function esc(str) {
    return str.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}



function renderFilters(active, trash) {
    const tags = [...new Set(active.flatMap(n => n.tags))].sort();
    if (view !== "all" && view !== "trash" && !tags.includes(view)) view = "all";
    const chip = (v, label) => `<button data-view="${esc(v)}" class="${view === v ? "active" : ""}">${label}</button>`;
    filtersTag.innerHTML = chip("all", "All") + tags.map(t => chip(t, "#" + esc(t))).join("") +
        chip("trash", `<i class="uil uil-trash"></i> Trash (${trash.length})`) +
        (view === "trash" && trash.length ? `<button class="danger" data-empty="1">Empty trash</button>` : "");
}

function showNotes() {
    const active = notes.filter(n => !n.trashed), trash = notes.filter(n => n.trashed);
    renderFilters(active, trash);
    const inTrash = view === "trash";
    addBox.style.display = inTrash ? "none" : "";

    const q = searchTag.value.trim().toLowerCase();
    const pool = inTrash ? trash : active.filter(n => view === "all" || n.tags.includes(view));
    const list = pool.filter(n =>
        [n.title, n.description, ...n.items.map(i => i.text), ...n.tags].join(" ").toLowerCase().includes(q));

    const sorts = { newest: (a, b) => b.ts - a.ts, oldest: (a, b) => a.ts - b.ts, title: (a, b) => a.title.localeCompare(b.title) };
    list.sort((a, b) => (b.pinned - a.pinned) || sorts[sortTag.value](a, b));

    wrapper.querySelectorAll(".note").forEach(li => li.remove());
    const html = list.map(n => {
        const body = n.type === "list"
            ? n.items.map((it, i) => `<label class="check${it.done ? " done" : ""}"><input type="checkbox" data-idx="${i}" ${it.done ? "checked" : ""}><span>${esc(it.text)}</span></label>`).join("")
            : `<span>${esc(n.description).replace(/\n/g, "<br/>")}</span>`;
        const menu = n.trashed
            ? `<li data-action="restore"><i class="uil uil-redo"></i>Restore</li>
               <li data-action="purge"><i class="uil uil-trash"></i>Delete forever</li>`
            : `<li data-action="pin"><i class="uil uil-pin"></i>${n.pinned ? "Unpin" : "Pin"}</li>
               <li data-action="edit"><i class="uil uil-pen"></i>Edit</li>
               <li data-action="delete"><i class="uil uil-trash"></i>Move to trash</li>`;
        return `<li class="note${n.pinned ? " pinned" : ""}" data-id="${n.id}" style="background:${n.color}">
            ${n.pinned ? '<i class="uil uil-pin pin-badge"></i>' : ""}
            <div class="details">
                <p>${esc(n.title) || "Untitled"}</p>
                ${body}
                ${n.tags.length ? `<div class="tags">${n.tags.map(t => `<em data-action="tag" data-tag="${esc(t)}">#${esc(t)}</em>`).join("")}</div>` : ""}
            </div>
            <div class="bottom-content">
                <span>${n.date}${n.edited ? " (edited)" : ""}</span>
                <div class="settings">
                    <i class="uil uil-ellipsis-h" data-action="menu"></i>
                    <ul class="menu">${menu}</ul>
                </div>
            </div>
        </li>`;
    }).join("");
    addBox.insertAdjacentHTML("afterend", html);

    counter.textContent = `(${active.length})`;
    emptyTag.textContent = inTrash ? "Trash is empty." : "No notes found.";
    emptyTag.hidden = list.length > 0 || (!inTrash && notes.length === 0);
}



function saveDraft() {
    if (editId !== null || !popupBox.classList.contains("show")) return;
    const d = { title: titleTag.value, desc: descTag.value, tags: tagsTag.value, color: selectedColor, type: noteType };
    if (!d.title && !d.desc && !d.tags) localStorage.removeItem("notesDraft");
    else localStorage.setItem("notesDraft", JSON.stringify(d));
}
function loadDraft() { try { return JSON.parse(localStorage.getItem("notesDraft")) || {}; } catch { return {}; } }
[titleTag, descTag, tagsTag].forEach(el => el.addEventListener("input", saveDraft));



function setType(t) {
    noteType = t;
    typeBtns.forEach(b => b.classList.toggle("active", b.dataset.type === t));
    descLabel.textContent = t === "list" ? "Items (one per line)" : "Description";
}
typeBtns.forEach(b => b.addEventListener("click", () => { setType(b.dataset.type); saveDraft(); }));

function renderColors() {
    colorBox.innerHTML = COLORS.map(c =>
        `<span data-color="${c}" style="background:${c}" class="${c === selectedColor ? "selected" : ""}"></span>`).join("");
}
colorBox.addEventListener("click", e => {
    if (!e.target.dataset.color) return;
    selectedColor = e.target.dataset.color;
    renderColors(); saveDraft();
});

function openPopup(note) {
    editId = note ? note.id : null;
    popupTitle.innerText = note ? "Update a Note" : "Add a new Note";
    addBtn.innerText = note ? "Update Note" : "Add Note";
    if (note) {
        titleTag.value = note.title;
        descTag.value = note.type === "list" ? note.items.map(i => i.text).join("\n") : note.description;
        tagsTag.value = note.tags.join(", ");
        selectedColor = note.color; setType(note.type);
        hintTag.textContent = HINT;
    } else {
        const d = loadDraft();
        titleTag.value = d.title || ""; descTag.value = d.desc || ""; tagsTag.value = d.tags || "";
        selectedColor = d.color || COLORS[0]; setType(d.type || "text");
        hintTag.textContent = (d.title || d.desc || d.tags) ? "Draft restored ✎" : HINT;
    }
    renderColors();
    popupBox.classList.add("show");
    document.body.style.overflow = "hidden";
    if (window.innerWidth > 660) titleTag.focus();
}
function closePopup() {
    editId = null;
    titleTag.value = descTag.value = tagsTag.value = "";
    popupBox.classList.remove("show");
    document.body.style.overflow = "auto";
}
addBox.addEventListener("click", () => openPopup());
closeIcon.addEventListener("click", closePopup);
popupBox.addEventListener("click", e => { if (e.target === popupBox) closePopup(); });




function parseTags() {
    return [...new Set(tagsTag.value.split(",").map(t => t.trim().replace(/^#/, "").toLowerCase()).filter(Boolean))].slice(0, 5);
}
function saveNote(e) {
    e && e.preventDefault();
    const title = titleTag.value.trim(), text = descTag.value.trim();
    if (!title && !text) return;
    const existing = editId !== null ? notes.find(n => n.id === editId) : null;
    const fields = { title, color: selectedColor, tags: parseTags(), type: noteType };
    if (noteType === "list") {
        const old = existing ? existing.items : [];
        fields.items = text.split("\n").map(s => s.trim()).filter(Boolean)
            .map(t => ({ text: t, done: !!(old.find(o => o.text === t) || {}).done }));
        fields.description = "";
    } else { fields.description = text; fields.items = []; }

    if (existing) Object.assign(existing, fields, { edited: true });
    else {
        const now = Date.now();
        notes.push(normalize({ id: now, ts: now, date: formatDate(new Date()), ...fields }));
        localStorage.removeItem("notesDraft");
    }
    save(); showNotes(); closePopup();
}
addBtn.addEventListener("click", saveNote);



wrapper.addEventListener("click", e => {
    const actionEl = e.target.closest("[data-action]"), li = e.target.closest(".note");
    if (!actionEl || !li) return;
    const id = Number(li.dataset.id), note = notes.find(n => n.id === id), action = actionEl.dataset.action;

    if (action === "menu") {
        const s = actionEl.parentElement, wasOpen = s.classList.contains("show");
        closeMenus();
        if (!wasOpen) s.classList.add("show");
        return;
    }
    closeMenus();
    if (action === "tag") { view = actionEl.dataset.tag; showNotes(); return; }
    if (action === "pin") note.pinned = !note.pinned;
    if (action === "edit") return openPopup(note);
    if (action === "delete") Object.assign(note, { trashed: true, deletedAt: Date.now(), pinned: false });
    if (action === "restore") Object.assign(note, { trashed: false, deletedAt: 0 });
    if (action === "purge") {
        if (!confirm("Delete this note forever? This cannot be undone.")) return;
        notes = notes.filter(n => n.id !== id);
    }
    save(); showNotes();
});



wrapper.addEventListener("change", e => {
    if (!e.target.matches(".check input")) return;
    const note = notes.find(n => n.id === Number(e.target.closest(".note").dataset.id));
    note.items[Number(e.target.dataset.idx)].done = e.target.checked;
    e.target.parentElement.classList.toggle("done", e.target.checked);
    save();
});
function closeMenus() { document.querySelectorAll(".settings.show").forEach(s => s.classList.remove("show")); }
document.addEventListener("click", e => { if (!e.target.closest(".settings")) closeMenus(); });




filtersTag.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.empty) {
        if (!confirm("Delete all notes in trash forever?")) return;
        notes = notes.filter(n => !n.trashed); save();
    } else view = b.dataset.view;
    showNotes();
});



document.addEventListener("keydown", e => {
    if (e.key === "Escape") { closePopup(); closeMenus(); }
    if (e.key === "Enter" && e.ctrlKey && popupBox.classList.contains("show")) saveNote();
});
searchTag.addEventListener("input", showNotes);
sortTag.addEventListener("change", () => { localStorage.setItem("notesSort", sortTag.value); showNotes(); });
sortTag.value = localStorage.getItem("notesSort") || "newest";




function applyTheme(light) {
    document.body.classList.toggle("light", light);
    themeBtn.innerHTML = `<i class="uil uil-${light ? "sun" : "moon"}"></i>`;
}
applyTheme(localStorage.getItem("notesTheme") === "light");
themeBtn.addEventListener("click", () => {
    const light = !document.body.classList.contains("light");
    localStorage.setItem("notesTheme", light ? "light" : "dark");
    applyTheme(light);
});


$("#exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(notes, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "notes-backup.json"; a.click();
    URL.revokeObjectURL(a.href);
});

showNotes();