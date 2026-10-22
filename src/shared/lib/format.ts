export function formatDate(value: string) {
    return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(new Date(value));
}
export function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    const unit = bytes < 1024 ** 2 ? 'KB' : bytes < 1024 ** 3 ? 'MB' : 'GB';
    const divisor = unit === 'KB' ? 1024 : unit === 'MB' ? 1024 ** 2 : 1024 ** 3;
    return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(bytes / divisor)} ${unit}`;
}
