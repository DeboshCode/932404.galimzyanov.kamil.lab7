"use strict";

const form = document.getElementById("note-form");
const titleInput = document.getElementById("note-title");
const bodyInput = document.getElementById("note-body");
const tagsInput = document.getElementById("note-tags");
const editorTitle = document.getElementById("editor-title");
const saveButton = document.getElementById("save-note");
const cancelButton = document.getElementById("cancel-edit");
const filterForm = document.getElementById("filter-form");
const filterInput = document.getElementById("filter-tag");
const showAllButton = document.getElementById("show-all");
const list = document.getElementById("notes-list");
const count = document.getElementById("notes-count");
const emptyList = document.getElementById("empty-list");
const message = document.getElementById("message");
let editingId = null;
let latestListRequest = 0;

function showMessage(text, isError = false) {
    message.textContent = text;
    message.classList.toggle("error", isError);
}

async function request(url, options = {}) {
    let response;

    try {
        response = await fetch(url, options);
    } catch {
        throw new Error("Не удалось связаться с сервером");
    }

    if (response.status === 204) {
        return null;
    }

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Не удалось выполнить запрос");
    }

    return data;
}

function resetEditor() {
    editingId = null;
    form.reset();
    editorTitle.textContent = "Новая заметка";
    saveButton.textContent = "Добавить заметку";
    cancelButton.hidden = true;
}

function editNote(note) {
    editingId = note.id;
    titleInput.value = note.title;
    bodyInput.value = note.body;
    tagsInput.value = note.tags.join(", ");
    editorTitle.textContent = "Редактирование заметки";
    saveButton.textContent = "Сохранить изменения";
    cancelButton.hidden = false;
    titleInput.focus();
}

async function deleteNote(note, button) {
    button.disabled = true;

    try {
        await request("/api/notes/" + note.id, { method: "DELETE" });

        if (editingId === note.id) {
            resetEditor();
        }

        showMessage("Заметка удалена.");
        await loadNotes();
    } catch (error) {
        showMessage(error.message, true);
        button.disabled = false;
    }
}

function createNoteCard(note) {
    const card = document.createElement("article");
    card.classList.add("note-card");

    const heading = document.createElement("h3");
    heading.textContent = note.title;
    card.appendChild(heading);

    if (note.body !== "") {
        const body = document.createElement("p");
        body.classList.add("note-body");
        body.textContent = note.body;
        card.appendChild(body);
    }

    const tags = document.createElement("ul");
    tags.classList.add("tags");
    tags.setAttribute("aria-label", "Теги заметки");

    for (const tag of note.tags) {
        const item = document.createElement("li");
        item.textContent = tag;
        tags.appendChild(item);
    }

    card.appendChild(tags);

    const actions = document.createElement("div");
    actions.classList.add("actions");
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.classList.add("secondary");
    editButton.textContent = "Изменить";
    editButton.setAttribute("aria-label", "Изменить заметку «" + note.title + "»");
    editButton.addEventListener("click", () => editNote(note));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.classList.add("secondary");
    deleteButton.textContent = "Удалить";
    deleteButton.setAttribute("aria-label", "Удалить заметку «" + note.title + "»");
    deleteButton.addEventListener("click", () => deleteNote(note, deleteButton));

    actions.appendChild(editButton);
    actions.appendChild(deleteButton);
    card.appendChild(actions);
    return card;
}

async function loadNotes() {
    const currentRequest = ++latestListRequest;
    const tag = filterInput.value.trim();
    const query = tag === "" ? "" : "?" + new URLSearchParams({ tag });

    try {
        const notes = await request("/api/notes" + query);

        if (currentRequest !== latestListRequest) {
            return;
        }

        list.replaceChildren();

        for (const note of notes) {
            list.appendChild(createNoteCard(note));
        }

        count.textContent = "Найдено заметок: " + notes.length;
        emptyList.hidden = notes.length !== 0;
        emptyList.textContent = tag === "" ? "Пока нет заметок." : "Заметок с таким тегом нет.";
    } catch (error) {
        if (currentRequest === latestListRequest) {
            count.textContent = "Не удалось загрузить список";
            showMessage(error.message, true);
        }
    }
}

async function saveNote(event) {
    event.preventDefault();
    const title = titleInput.value.trim();

    if (title === "") {
        showMessage("Название заметки не должно быть пустым", true);
        titleInput.focus();
        return;
    }

    const note = {
        title,
        body: bodyInput.value,
        tags: tagsInput.value.split(",").map((tag) => tag.trim()).filter((tag) => tag !== "")
    };
    const isEditing = editingId !== null;
    const url = isEditing ? "/api/notes/" + editingId : "/api/notes";
    saveButton.disabled = true;

    try {
        await request(url, {
            method: isEditing ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(note)
        });
        resetEditor();
        showMessage(isEditing ? "Изменения сохранены." : "Заметка добавлена.");
        await loadNotes();
    } catch (error) {
        showMessage(error.message, true);
    } finally {
        saveButton.disabled = false;
    }
}

if (form && titleInput && bodyInput && tagsInput && editorTitle && saveButton && cancelButton
    && filterForm && filterInput && showAllButton && list && count && emptyList && message) {
    form.addEventListener("submit", saveNote);
    cancelButton.addEventListener("click", () => {
        resetEditor();
        titleInput.focus();
    });
    filterForm.addEventListener("submit", (event) => {
        event.preventDefault();
        loadNotes();
    });
    showAllButton.addEventListener("click", () => {
        filterInput.value = "";
        loadNotes();
    });
    loadNotes();
} else {
    console.error("Не найдены элементы страницы заметок");
}
