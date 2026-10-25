/** Product language choices; values follow the shared backend LanguageSchema. */
export const BOOK_LANGUAGES = [
    { value: 'vi', label: 'Tiếng Việt' },
    { value: 'en', label: 'Tiếng Anh' },
    { value: 'zh', label: 'Tiếng Trung' },
    { value: 'ja', label: 'Tiếng Nhật' },
    { value: 'ko', label: 'Tiếng Hàn' },
    { value: 'fr', label: 'Tiếng Pháp' },
    { value: 'de', label: 'Tiếng Đức' },
    { value: 'es', label: 'Tiếng Tây Ban Nha' },
];

/** Keep an existing regional or unlisted value until the user deliberately changes it. */
export function bookLanguageOptions(current: string) {
    if (BOOK_LANGUAGES.some((option) => option.value === current)) return BOOK_LANGUAGES;
    const base = BOOK_LANGUAGES.find((option) => option.value === current.split('-')[0]);
    return [
        ...BOOK_LANGUAGES,
        { value: current, label: `${base?.label || 'Ngôn ngữ hiện tại'} (${current})` },
    ];
}
