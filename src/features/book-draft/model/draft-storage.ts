import type { DraftRecord } from './draft-model';
export interface DraftStorage {
    read(key: string): Promise<unknown>;
    write(key: string, value: DraftRecord): Promise<void>;
    remove(key: string): Promise<void>;
}
let connection: Promise<IDBDatabase> | undefined;
function open() {
    connection ??= new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('bookaria-studio-drafts', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('books');
        request.onerror = () => {
            connection = undefined;
            reject(request.error);
        };
        request.onblocked = () => {
            connection = undefined;
            reject(new Error('Kho bản nháp đang bận.'));
        };
        request.onsuccess = () => {
            const db = request.result;
            db.onversionchange = () => {
                db.close();
                connection = undefined;
            };
            resolve(db);
        };
    });
    return connection;
}
async function transaction<T>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
    const db = await open();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('books', mode),
            request = action(tx.objectStore('books'));
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}
export const draftStorage: DraftStorage = {
    read: (key) => transaction('readonly', (store) => store.get(key)),
    async write(key, value) {
        await transaction('readwrite', (store) => store.put(value, key));
    },
    async remove(key) {
        await transaction('readwrite', (store) => store.delete(key));
    },
};
