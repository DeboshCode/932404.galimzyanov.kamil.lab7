import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

export function createNotesStore(filename) {
    if (filename !== ":memory:") {
        mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
    }

    const database = new Database(filename);

    database.exec(`
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL CHECK (length(trim(title)) > 0),
            body TEXT NOT NULL DEFAULT '',
            tags TEXT NOT NULL DEFAULT '[]'
                CHECK (json_valid(tags) AND json_type(tags) = 'array')
        )
    `);

    const selectAll = database.prepare("SELECT id, title, body, tags FROM notes ORDER BY id DESC");
    const selectByTag = database.prepare(`
        SELECT id, title, body, tags FROM notes
        WHERE EXISTS (SELECT 1 FROM json_each(notes.tags) WHERE json_each.value = ?)
        ORDER BY id DESC
    `);
    const selectById = database.prepare("SELECT id, title, body, tags FROM notes WHERE id = ?");
    const insert = database.prepare("INSERT INTO notes (title, body, tags) VALUES (?, ?, ?)");
    const update = database.prepare("UPDATE notes SET title = ?, body = ?, tags = ? WHERE id = ?");
    const remove = database.prepare("DELETE FROM notes WHERE id = ?");

    function decode(row) {
        return row ? { id: row.id, title: row.title, body: row.body, tags: JSON.parse(row.tags) } : null;
    }

    function getNote(id) {
        return decode(selectById.get(id));
    }

    function listNotes(tag) {
        return (tag === undefined ? selectAll.all() : selectByTag.all(tag)).map(decode);
    }

    function createNote(note) {
        const result = insert.run(note.title, note.body, JSON.stringify(note.tags));
        return getNote(Number(result.lastInsertRowid));
    }

    function updateNote(id, note) {
        const result = update.run(note.title, note.body, JSON.stringify(note.tags), id);
        return result.changes === 0 ? null : getNote(id);
    }

    function deleteNote(id) {
        return remove.run(id).changes > 0;
    }

    function close() {
        database.close();
    }

    return { listNotes, getNote, createNote, updateNote, deleteNote, close };
}
