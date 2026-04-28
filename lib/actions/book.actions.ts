'use server';

import {CreateBook, TextSegment} from "@/types";
import {escapeRegex, generateSlug} from "@/lib/utils";

type TempBook = CreateBook & {
    _id: string;
    slug: string;
    totalSegments: number;
    createdAt: Date;
    updatedAt: Date;
};

type TempSegment = {
    clerkId: string;
    bookId: string;
    content: string;
    segmentIndex: number;
    pageNumber?: number;
    wordCount: number;
};

const tempBooks = new Map<string, TempBook>();
const tempSegments = new Map<string, TempSegment[]>();

type ActionResult<T> = {
    success: boolean;
    data?: T;
    error?: unknown;
    alreadyExists?: boolean;
    isBillingError?: boolean;
};

export const getAllBooks = async (search?: string) => {
    try {
        let books = Array.from(tempBooks.values());

        if (search?.trim()) {
            const escapedSearch = escapeRegex(search);
            const regex = new RegExp(escapedSearch, 'i');
            books = books.filter((book) => regex.test(book.title) || regex.test(book.author));
        }

        books.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        return {
            success: true,
            data: books
        }
    } catch (e) {
        console.error('Error getting books', e);
        return {
            success: false, error: e
        }
    }
}

export const checkBookExists = async (title: string) => {
    try {
        const slug = generateSlug(title);
        const existingBook = tempBooks.get(slug);

        if(existingBook) {
            return {
                exists: true,
                book: existingBook
            }
        }

        return {
            exists: false,
        }
    } catch (e) {
        console.error('Error checking book exists', e);
        return {
            exists: false, error: e
        }
    }
}

export const createBook = async (data: CreateBook): Promise<ActionResult<TempBook>> => {
    try {
        const slug = generateSlug(data.title);
        const existingBook = tempBooks.get(slug);

        if(existingBook) {
            return {
                success: true,
                data: existingBook,
                alreadyExists: true,
            }
        }

        const now = new Date();
        const book: TempBook = {
            ...data,
            _id: crypto.randomUUID(),
            slug,
            totalSegments: 0,
            createdAt: now,
            updatedAt: now,
        };
        tempBooks.set(slug, book);

        return {
            success: true,
            data: book,
        }
    } catch (e) {
        console.error('Error creating a book', e);

        return {
            success: false,
            error: e,
        }
    }
}

export const getBookBySlug = async (slug: string) => {
    try {
        const book = tempBooks.get(slug);

        if (!book) {
            return { success: false, error: 'Book not found' };
        }

        return {
            success: true,
            data: book
        }
    } catch (e) {
        console.error('Error fetching book by slug', e);
        return {
            success: false, error: e
        }
    }
}

export const saveBookSegments = async (bookId: string, clerkId: string, segments: TextSegment[]) => {
    try {
        console.log('Saving book segments...');

        const segmentsToSave = segments.map(({ text, segmentIndex, pageNumber, wordCount }) => ({
            clerkId, bookId, content: text, segmentIndex, pageNumber, wordCount
        }));

        tempSegments.set(bookId, segmentsToSave);

        for (const [slug, book] of tempBooks.entries()) {
            if (book._id === bookId) {
                tempBooks.set(slug, {
                    ...book,
                    totalSegments: segments.length,
                    updatedAt: new Date(),
                });
                break;
            }
        }

        console.log('Book segments saved successfully.');

        return {
            success: true,
            data: { segmentsCreated: segments.length}
        }
    } catch (e) {
        console.error('Error saving book segments', e);

        return {
            success: false,
            error: e,
        }
    }
}

// Searches book segments using MongoDB text search with regex fallback
export const searchBookSegments = async (bookId: string, query: string, limit: number = 5) => {
    try {
        console.log(`Searching for: "${query}" in book ${bookId}`);
        const bookSegments = tempSegments.get(bookId) ?? [];
        const keywords = query.split(/\s+/).filter((k) => k.length > 2);
        const pattern = keywords.length > 0 ? keywords.map(escapeRegex).join('|') : escapeRegex(query);
        const regex = new RegExp(pattern, 'i');

        const segments = bookSegments
            .filter((segment) => regex.test(segment.content))
            .sort((a, b) => a.segmentIndex - b.segmentIndex)
            .slice(0, limit);

        console.log(`Search complete. Found ${segments.length} results`);

        return {
            success: true,
            data: segments,
        };
    } catch (error) {
        console.error('Error searching segments:', error);
        return {
            success: false,
            error: (error as Error).message,
            data: [],
        };
    }
};