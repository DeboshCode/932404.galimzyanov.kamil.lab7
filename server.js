import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createNotesStore } from "./database.js";
import { ValidationError, validateNote, parseNoteId } from "./validation.js";

const projectDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultDatabasePath = path.join(projectDirectory, "data", "notes.sqlite");

export function createApp(databasePath = defaultDatabasePath) {
    const app = express();
    const notes = createNotesStore(databasePath);

    app.disable("x-powered-by");
    app.use(express.json({ limit: "128kb" }));
    app.use("/api", (request, response, next) => {
        response.set("Cache-Control", "no-store");
        next();
    });

    app.get("/api/notes", (request, response) => {
        let tag = request.query.tag;

        if (tag !== undefined) {
            if (typeof tag !== "string" || tag.trim() === "") {
                throw new ValidationError("Параметр tag должен быть непустой строкой");
            }

            tag = tag.trim();
        }

        response.json(notes.listNotes(tag));
    });

    app.get("/api/notes/:id", (request, response) => {
        const id = parseNoteId(request.params.id);
        const note = id === null ? null : notes.getNote(id);

        if (!note) {
            return response.status(404).json({ error: "Заметка не найдена" });
        }

        response.json(note);
    });

    app.post("/api/notes", (request, response) => {
        const note = notes.createNote(validateNote(request.body));
        response.status(201).location("/api/notes/" + note.id).json(note);
    });

    app.put("/api/notes/:id", (request, response) => {
        const id = parseNoteId(request.params.id);

        if (id === null || !notes.getNote(id)) {
            return response.status(404).json({ error: "Заметка не найдена" });
        }

        const note = notes.updateNote(id, validateNote(request.body));

        if (!note) {
            return response.status(404).json({ error: "Заметка не найдена" });
        }

        response.json(note);
    });

    app.delete("/api/notes/:id", (request, response) => {
        const id = parseNoteId(request.params.id);

        if (id === null || !notes.deleteNote(id)) {
            return response.status(404).json({ error: "Заметка не найдена" });
        }

        response.status(204).end();
    });

    app.use(express.static(path.join(projectDirectory, "public")));

    app.use((request, response) => {
        response.status(404).json({ error: "Not found" });
    });

    app.use((error, request, response, next) => {
        if (error instanceof ValidationError) {
            return response.status(400).json({ error: error.message });
        }

        if (error.type === "entity.parse.failed") {
            return response.status(400).json({ error: "Некорректный JSON" });
        }

        if (error.type === "entity.too.large") {
            return response.status(413).json({ error: "Слишком большой запрос" });
        }

        console.error(error.message);
        response.status(500).json({ error: "Internal server error" });
    });

    return { app, notes };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const port = Number(process.env.PORT || 3000);

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        console.error("Некорректный номер порта");
        process.exitCode = 1;
    } else {
        const { app, notes } = createApp(process.env.DATABASE_PATH || defaultDatabasePath);
        const server = app.listen(port, "127.0.0.1", () => {
            console.log("Server started on http://localhost:" + port);
        });

        server.on("error", (error) => {
            console.error(error.code === "EADDRINUSE" ? "Порт " + port + " уже занят" : error.message);
            notes.close();
            process.exitCode = 1;
        });

        function shutdown() {
            server.close(() => notes.close());
        }

        process.once("SIGINT", shutdown);
        process.once("SIGTERM", shutdown);
    }
}
