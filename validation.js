export class ValidationError extends Error {}

export function validateNote(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new ValidationError("Передайте объект с данными заметки");
    }

    if (typeof input.title !== "string" || input.title.trim() === "") {
        throw new ValidationError("Название заметки не должно быть пустым");
    }

    const body = input.body === undefined ? "" : input.body;
    const tags = input.tags === undefined ? [] : input.tags;

    if (typeof body !== "string") {
        throw new ValidationError("Текст заметки должен быть строкой");
    }

    if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== "string" || tag.trim() === "")) {
        throw new ValidationError("Теги должны быть массивом непустых строк");
    }

    return {
        title: input.title.trim(),
        body,
        tags: [...new Set(tags.map((tag) => tag.trim()))]
    };
}

export function parseNoteId(value) {
    if (!/^\d+$/.test(value)) {
        return null;
    }

    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}
