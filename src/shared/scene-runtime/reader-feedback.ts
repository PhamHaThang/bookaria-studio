export type ReaderNoticeOptions = {
    kind?: 'info' | 'error';
    action?: 'retry' | 'media';
    mediaPermission?: boolean;
};

/** Recovery actions come from the caller, never from words found inside a message. */
export function readerFeedback(message: string, options: ReaderNoticeOptions = {}) {
    return {
        visible: Boolean(message),
        retry: Boolean(message) && options.action === 'retry',
        media: Boolean(message) && options.action === 'media',
        mediaLabel: options.mediaPermission ? 'Chạm để bật âm thanh' : 'Thử phát lại',
        role: options.kind === 'error' ? 'alert' : 'status',
    } as const;
}
