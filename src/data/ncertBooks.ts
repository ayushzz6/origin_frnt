export type NCERTChapter = {
    id: string;
    title: string;
    pdfFile?: string; // Explicit mapping to the PDF filename
}

export type NCERTBook = {
    id: string;
    title: string;
    bookClass: string;
    subject: string;
    code: string; // The URL code used by NCERT site
    chapters?: NCERTChapter[];
    totalChapters?: number;
    basePath?: string; // The directory structure under /public/books/
}

function chapterRange(prefix: string, from: number, to: number): NCERTChapter[] {
    const out: NCERTChapter[] = [];
    for (let i = from; i <= to; i++) {
        out.push({ id: `${prefix}${i}`, title: `Chapter ${i}`, pdfFile: `Chapter ${i}.pdf` });
    }
    return out;
}

const pre: NCERTChapter = { id: 'pre', title: 'Prelims', pdfFile: 'Introduction.pdf' };
const answers: NCERTChapter = { id: 'ans', title: 'Answers', pdfFile: 'Answers.pdf' };

export const ncertBooksData: NCERTBook[] = [
    // ----- Class 11 -----
    {
        id: 'ncert-bio-11', title: 'Biology', bookClass: '11', subject: 'Biology', code: 'kebo1',
        basePath: '11/Biology',
        chapters: [pre, ...chapterRange('ch', 1, 19)],
        totalChapters: 19,
    },
    {
        id: 'ncert-chem-11-1', title: 'Chemistry Part I', bookClass: '11', subject: 'Chemistry', code: 'kech1',
        basePath: '11/Chemistry/Part1',
        chapters: [pre, ...chapterRange('ch', 1, 6), answers],
        totalChapters: 6,
    },
    {
        id: 'ncert-chem-11-2', title: 'Chemistry Part II', bookClass: '11', subject: 'Chemistry', code: 'kech2',
        basePath: '11/Chemistry/Part2',
        chapters: [pre, ...chapterRange('ch', 1, 3), answers],
        totalChapters: 3,
    },
    {
        id: 'ncert-math-11', title: 'Mathematics', bookClass: '11', subject: 'Mathematics', code: 'kemh1',
        basePath: '11/Mathematics',
        chapters: [pre, ...chapterRange('ch', 1, 14), answers],
        totalChapters: 14,
    },
    {
        id: 'ncert-phy-11-1', title: 'Physics Part I', bookClass: '11', subject: 'Physics', code: 'keph1',
        basePath: '11/Physics/Part1',
        chapters: [pre, ...chapterRange('ch', 1, 7), answers],
        totalChapters: 7,
    },
    {
        id: 'ncert-phy-11-2', title: 'Physics Part II', bookClass: '11', subject: 'Physics', code: 'keph2',
        basePath: '11/Physics/Part2',
        chapters: [pre, ...chapterRange('ch', 1, 7), answers],
        totalChapters: 7,
    },

    // ----- Class 12 -----
    {
        id: 'ncert-bio-12', title: 'Biology', bookClass: '12', subject: 'Biology', code: 'lebo1',
        basePath: '12/Biology',
        chapters: [pre, ...chapterRange('ch', 1, 13)],
        totalChapters: 13,
    },
    {
        id: 'ncert-chem-12-1', title: 'Chemistry Part I', bookClass: '12', subject: 'Chemistry', code: 'lech1',
        basePath: '12/Chemistry/Part1',
        chapters: [pre, ...chapterRange('ch', 1, 5), answers],
        totalChapters: 5,
    },
    {
        id: 'ncert-chem-12-2', title: 'Chemistry Part II', bookClass: '12', subject: 'Chemistry', code: 'lech2',
        basePath: '12/Chemistry/Part2',
        chapters: [pre, ...chapterRange('ch', 1, 5), answers],
        totalChapters: 5,
    },
    {
        id: 'ncert-math-12-1', title: 'Mathematics Part I', bookClass: '12', subject: 'Mathematics', code: 'lemh1',
        basePath: '12/Mathematics/Part1',
        chapters: [pre, ...chapterRange('ch', 1, 6), answers],
        totalChapters: 6,
    },
    {
        id: 'ncert-math-12-2', title: 'Mathematics Part II', bookClass: '12', subject: 'Mathematics', code: 'lemh2',
        basePath: '12/Mathematics/Part2',
        chapters: [pre, ...chapterRange('ch', 1, 7), answers],
        totalChapters: 7,
    },
    {
        id: 'ncert-phy-12-1', title: 'Physics Part I', bookClass: '12', subject: 'Physics', code: 'leph1',
        basePath: '12/Physics/Part1',
        chapters: [pre, ...chapterRange('ch', 1, 8), answers],
        totalChapters: 8,
    },
    {
        id: 'ncert-phy-12-2', title: 'Physics Part II', bookClass: '12', subject: 'Physics', code: 'leph2',
        basePath: '12/Physics/Part2',
        chapters: [pre, ...chapterRange('ch', 1, 6)],
        totalChapters: 6,
    },
];

export const ncertClasses = ['12', '11'];

export const ncertSubjectsByClass: Record<string, string[]> = {
    '12': ['Biology', 'Chemistry', 'Mathematics', 'Physics'],
    '11': ['Biology', 'Chemistry', 'Mathematics', 'Physics'],
};
