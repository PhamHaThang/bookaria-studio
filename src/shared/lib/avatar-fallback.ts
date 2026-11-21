export function getAvatarFallback(name?: string) {
    const normalized = name?.trim().normalize('NFC').replace(/\s+/g, ' ') ?? '';
    const words = normalized.split(' ');
    const initials = (words.length > 1 ? [words[0], words[words.length - 1]] : words)
        .map((word) => Array.from(word)[0] ?? '')
        .join('')
        .toLocaleUpperCase('vi');
    return { initials };
}
