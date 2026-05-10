import { requireUserFromRequest } from "@/server/auth";
import { awardPoints } from "@/server/gamification";
import { badRequest, created, noContent, notFound, ok, unauthorized } from "@/server/http";
import type { AppStore, StoredBookmark, StoredBook, StoredNote } from "@/server/store";
import { createId, withStoreAsync } from "@/server/store";

type StudyPayload = Record<string, unknown>;

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  return value.map((item) => String(item).trim()).filter((item) => item.length > 0);
}

function serializeBook(book: StoredBook, isSaved: boolean) {
  return {
    id: book.id,
    title: book.title,
    bookClass: book.bookClass,
    book_class: book.bookClass,
    subject: book.subject,
    coverImage: book.coverImage,
    cover_image: book.coverImage,
    chapters: book.chapters,
    isLiked: isSaved,
    is_liked: isSaved,
    basePath: book.basePath,
    base_path: book.basePath,
  };
}

function serializeNote(note: StoredNote) {
  return {
    id: note.id,
    book: note.bookId,
    bookId: note.bookId,
    book_id: note.bookId,
    chapter: note.chapterId,
    chapterId: note.chapterId,
    chapter_id: note.chapterId,
    pageNumber: note.pageNumber,
    page_number: note.pageNumber,
    content: note.content,
    color: note.color,
    tags: note.tags,
    createdAt: note.createdAt,
    created_at: note.createdAt,
    updatedAt: note.updatedAt,
    updated_at: note.updatedAt,
  };
}

function serializeBookmark(bookmark: StoredBookmark) {
  return {
    id: bookmark.id,
    book: bookmark.bookId,
    bookId: bookmark.bookId,
    book_id: bookmark.bookId,
    pageNumber: bookmark.pageNumber,
    page_number: bookmark.pageNumber,
    title: bookmark.title,
    createdAt: bookmark.createdAt,
    created_at: bookmark.createdAt,
  };
}

function findBook(store: AppStore, bookId: string): StoredBook | null {
  return store.books.find((book) => book.id === bookId) ?? null;
}

async function handleBooksList(request: Request) {
  return withStoreAsync(async (store) => {
    const user = await requireUserFromRequest(store, request);
    if (!user) {
      return unauthorized();
    }
    const savedBookIds = new Set(
      store.savedBooks.filter((entry) => entry.userId === user.id).map((entry) => entry.bookId),
    );
    return ok(store.books.map((book) => serializeBook(book, savedBookIds.has(book.id))));
  });
}

async function handleBookDetail(request: Request, bookId: string) {
  return withStoreAsync(async (store) => {
    const user = await requireUserFromRequest(store, request);
    if (!user) {
      return unauthorized();
    }
    const book = findBook(store, bookId);
    if (!book) {
      return notFound("Book not found.");
    }
    const isSaved = store.savedBooks.some((entry) => entry.userId === user.id && entry.bookId === book.id);
    return ok(serializeBook(book, isSaved));
  });
}

async function handleToggleSave(request: Request, bookId: string) {
  return withStoreAsync(async (store) => {
    const user = await requireUserFromRequest(store, request);
    if (!user) {
      return unauthorized();
    }

    const book = findBook(store, bookId);
    if (!book) {
      return notFound("Book not found.");
    }

    const existingIndex = store.savedBooks.findIndex(
      (entry) => entry.userId === user.id && entry.bookId === bookId,
    );

    if (existingIndex >= 0) {
      store.savedBooks.splice(existingIndex, 1);
      return ok({ status: "unsaved" });
    }

    store.savedBooks.push({
      id: createId("saved_book"),
      userId: user.id,
      bookId: book.id,
      createdAt: new Date().toISOString(),
    });
    awardPoints(store, user.id, 10, "study_corner", `Saved book to library: ${book.title}`, book.id);
    return created({ status: "saved" });
  });
}

async function handleLibrary(request: Request) {
  return withStoreAsync(async (store) => {
    const user = await requireUserFromRequest(store, request);
    if (!user) {
      return unauthorized();
    }
    const savedBookIds = new Set(
      store.savedBooks.filter((entry) => entry.userId === user.id).map((entry) => entry.bookId),
    );
    const books = store.books
      .filter((book) => savedBookIds.has(book.id))
      .map((book) => serializeBook(book, true));
    return ok(books);
  });
}

async function handleNotesList(request: Request) {
  return withStoreAsync(async (store) => {
    const user = await requireUserFromRequest(store, request);
    if (!user) {
      return unauthorized();
    }
    const notes = store.notes
      .filter((note) => note.userId === user.id)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(serializeNote);
    return ok(notes);
  });
}

async function handleNoteCreate(request: Request, payload: StudyPayload) {
  return withStoreAsync(async (store) => {
    const user = await requireUserFromRequest(store, request);
    if (!user) {
      return unauthorized();
    }
    const bookId = asString(payload.book ?? payload.bookId ?? payload.book_id);
    const content = asString(payload.content)?.trim();
    if (!bookId || !content) {
      return badRequest("book and content are required.");
    }
    if (!findBook(store, bookId)) {
      return badRequest("book: valid book id is required.");
    }

    const note: StoredNote = {
      id: createId("note"),
      userId: user.id,
      bookId,
      chapterId: asString(payload.chapter ?? payload.chapterId ?? payload.chapter_id),
      pageNumber: asNumber(payload.pageNumber ?? payload.page_number),
      content,
      color: asString(payload.color) ?? "#FEF3C7",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: asStringArray(payload.tags) ?? [],
    };

    store.notes.unshift(note);
    return created(serializeNote(note));
  });
}

async function handleNoteDetail(request: Request, noteId: string) {
  return withStoreAsync(async (store) => {
    const user = await requireUserFromRequest(store, request);
    if (!user) {
      return unauthorized();
    }
    const note = store.notes.find((entry) => entry.userId === user.id && entry.id === noteId);
    if (!note) {
      return notFound("Note not found.");
    }
    return ok(serializeNote(note));
  });
}

async function handleNoteUpdate(request: Request, noteId: string, payload: StudyPayload) {
  return withStoreAsync(async (store) => {
    const user = await requireUserFromRequest(store, request);
    if (!user) {
      return unauthorized();
    }
    const note = store.notes.find((entry) => entry.userId === user.id && entry.id === noteId);
    if (!note) {
      return notFound("Note not found.");
    }

    const bookId = asString(payload.book ?? payload.bookId ?? payload.book_id);
    const content = asString(payload.content);
    const chapterId = asString(payload.chapter ?? payload.chapterId ?? payload.chapter_id);
    const pageNumber = asNumber(payload.pageNumber ?? payload.page_number);
    const color = asString(payload.color);
    const tags = asStringArray(payload.tags);

    if (bookId !== null) {
      if (!findBook(store, bookId)) {
        return badRequest("book: valid book id is required.");
      }
      note.bookId = bookId;
    }
    if (content !== null) note.content = content;
    if (chapterId !== null) note.chapterId = chapterId;
    if (pageNumber !== null) note.pageNumber = pageNumber;
    if (color !== null) note.color = color;
    if (tags !== null) note.tags = tags;
    note.updatedAt = new Date().toISOString();

    return ok(serializeNote(note));
  });
}

async function handleNoteDelete(request: Request, noteId: string) {
  return withStoreAsync(async (store) => {
    const user = await requireUserFromRequest(store, request);
    if (!user) {
      return unauthorized();
    }
    const originalLength = store.notes.length;
    store.notes = store.notes.filter((entry) => !(entry.userId === user.id && entry.id === noteId));
    if (store.notes.length === originalLength) {
      return notFound("Note not found.");
    }
    return noContent();
  });
}

async function handleBookmarksList(request: Request) {
  return withStoreAsync(async (store) => {
    const user = await requireUserFromRequest(store, request);
    if (!user) {
      return unauthorized();
    }
    return ok(
      store.bookmarks
        .filter((entry) => entry.userId === user.id)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map(serializeBookmark),
    );
  });
}

async function handleBookmarkCreate(request: Request, payload: StudyPayload) {
  return withStoreAsync(async (store) => {
    const user = await requireUserFromRequest(store, request);
    if (!user) {
      return unauthorized();
    }
    const bookId = asString(payload.book ?? payload.bookId ?? payload.book_id);
    const pageNumber = asNumber(payload.pageNumber ?? payload.page_number);
    const title = asString(payload.title)?.trim();
    if (!bookId || pageNumber === null || !title) {
      return badRequest("book, pageNumber, and title are required.");
    }
    if (!findBook(store, bookId)) {
      return badRequest("book: valid book id is required.");
    }

    const bookmark: StoredBookmark = {
      id: createId("bookmark"),
      userId: user.id,
      bookId,
      pageNumber: Math.floor(pageNumber),
      title,
      createdAt: new Date().toISOString(),
    };
    store.bookmarks.unshift(bookmark);
    return created(serializeBookmark(bookmark));
  });
}

async function handleBookmarkDetail(request: Request, bookmarkId: string) {
  return withStoreAsync(async (store) => {
    const user = await requireUserFromRequest(store, request);
    if (!user) {
      return unauthorized();
    }
    const bookmark = store.bookmarks.find((entry) => entry.userId === user.id && entry.id === bookmarkId);
    if (!bookmark) {
      return notFound("Bookmark not found.");
    }
    return ok(serializeBookmark(bookmark));
  });
}

async function handleBookmarkUpdate(request: Request, bookmarkId: string, payload: StudyPayload) {
  return withStoreAsync(async (store) => {
    const user = await requireUserFromRequest(store, request);
    if (!user) {
      return unauthorized();
    }
    const bookmark = store.bookmarks.find((entry) => entry.userId === user.id && entry.id === bookmarkId);
    if (!bookmark) {
      return notFound("Bookmark not found.");
    }

    const bookId = asString(payload.book ?? payload.bookId ?? payload.book_id);
    const title = asString(payload.title);
    const pageNumber = asNumber(payload.pageNumber ?? payload.page_number);
    if (bookId !== null) {
      if (!findBook(store, bookId)) {
        return badRequest("book: valid book id is required.");
      }
      bookmark.bookId = bookId;
    }
    if (title !== null) bookmark.title = title;
    if (pageNumber !== null) bookmark.pageNumber = Math.floor(pageNumber);
    return ok(serializeBookmark(bookmark));
  });
}

async function handleBookmarkDelete(request: Request, bookmarkId: string) {
  return withStoreAsync(async (store) => {
    const user = await requireUserFromRequest(store, request);
    if (!user) {
      return unauthorized();
    }
    const originalLength = store.bookmarks.length;
    store.bookmarks = store.bookmarks.filter((entry) => !(entry.userId === user.id && entry.id === bookmarkId));
    if (store.bookmarks.length === originalLength) {
      return notFound("Bookmark not found.");
    }
    return noContent();
  });
}

export async function handleStudyRequest(method: string, slug: string[], request: Request, payload: StudyPayload) {
  if (slug.length === 1 && slug[0] === "books" && method === "GET") {
    return handleBooksList(request);
  }
  if (slug.length === 2 && slug[0] === "books" && method === "GET") {
    return handleBookDetail(request, slug[1]);
  }
  if (slug.length === 3 && slug[0] === "books" && slug[2] === "toggle_save" && method === "POST") {
    return handleToggleSave(request, slug[1]);
  }
  if (slug.length === 2 && slug[0] === "books" && slug[1] === "library" && method === "GET") {
    return handleLibrary(request);
  }

  if (slug.length === 1 && slug[0] === "notes" && method === "GET") {
    return handleNotesList(request);
  }
  if (slug.length === 1 && slug[0] === "notes" && method === "POST") {
    return handleNoteCreate(request, payload);
  }
  if (slug.length === 2 && slug[0] === "notes" && method === "GET") {
    return handleNoteDetail(request, slug[1]);
  }
  if (slug.length === 2 && slug[0] === "notes" && (method === "PUT" || method === "PATCH")) {
    return handleNoteUpdate(request, slug[1], payload);
  }
  if (slug.length === 2 && slug[0] === "notes" && method === "DELETE") {
    return handleNoteDelete(request, slug[1]);
  }

  if (slug.length === 1 && slug[0] === "bookmarks" && method === "GET") {
    return handleBookmarksList(request);
  }
  if (slug.length === 1 && slug[0] === "bookmarks" && method === "POST") {
    return handleBookmarkCreate(request, payload);
  }
  if (slug.length === 2 && slug[0] === "bookmarks" && method === "GET") {
    return handleBookmarkDetail(request, slug[1]);
  }
  if (slug.length === 2 && slug[0] === "bookmarks" && (method === "PUT" || method === "PATCH")) {
    return handleBookmarkUpdate(request, slug[1], payload);
  }
  if (slug.length === 2 && slug[0] === "bookmarks" && method === "DELETE") {
    return handleBookmarkDelete(request, slug[1]);
  }

  return notFound("Endpoint not found.");
}
