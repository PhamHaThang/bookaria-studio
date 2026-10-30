import type {
    BookDraftSnapshot,
    SaveBookDraftBody,
    SaveBookDraftResult,
} from '@/shared/contracts/api/book-draft.schema';
import { SaveBookDraftBodySchema } from '@/shared/contracts/api/book-draft.schema';
import type { AssetRef } from '@/shared/contracts/asset.schema';
import {
    type Asset,
    type Page,
    type PageSummary,
    PageSummarySchema,
} from '@/shared/contracts/dto.schema';
import { PageSettingsSchema, type Scene, SceneSchema } from '@/shared/contracts/scene.schema';
import type { UploadCheckpoint } from '../../assets/model/upload';
import { blankPageDimensions } from '../../pages/model/blank-page';
import {
    type DraftRecord,
    DraftRecordSchema,
    draftChanges,
    fingerprint,
    freshWorking,
    safeCheckpoint,
    type WorkingBook,
    workingDirty,
} from './draft-model';
import type { DraftStorage } from './draft-storage';
import { rebaseSavedBook } from './rebase-save';

type Dependencies = {
    read: (id: string, signal?: AbortSignal) => Promise<BookDraftSnapshot>;
    save: (id: string, body: SaveBookDraftBody) => Promise<SaveBookDraftResult>;
    page: (id: string, signal?: AbortSignal) => Promise<Page>;
    imageLayout: (
        bookId: string,
        imageId: string,
        aspect: number,
    ) => Promise<{ assetId: string; url: string; width: number; height: number }>;
    storage: DraftStorage;
    message: (cause: unknown) => string;
    uncertain: (cause: unknown) => boolean;
    conflict: (cause: unknown) => boolean;
    removeAsset: (id: string) => Promise<void>;
    blankPageUrl?: string;
    prepareBlankImage?: (
        aspect: number,
        checkpoint: UploadCheckpoint | null,
        save: (value: UploadCheckpoint) => void,
        signal: AbortSignal,
    ) => Promise<Asset>;
};
export type DraftState = {
    base: BookDraftSnapshot | null;
    working: WorkingBook | null;
    loading: boolean;
    saving: boolean;
    autosaving: boolean;
    editVersion: number;
    dirty: boolean;
    conflict: boolean;
    uncertain: boolean;
    error: string | null;
    notice: string | null;
    storageWarning: string | null;
    jobs: { pageId: string; jobId: string }[];
    recovery: DraftRecord | null;
    version: number;
    canUndo: boolean;
    canRedo: boolean;
};
type Entry = { working: WorkingBook; focus: string };
export class BookDraftStore {
    private state: DraftState = {
        base: null,
        working: null,
        loading: true,
        saving: false,
        autosaving: false,
        editVersion: 0,
        dirty: false,
        conflict: false,
        uncertain: false,
        error: null,
        notice: null,
        storageWarning: null,
        jobs: [],
        recovery: null,
        version: 0,
        canUndo: false,
        canRedo: false,
    };
    private listeners = new Set<() => void>();
    private basePages: Record<string, Page> = {};
    private assets: Record<string, AssetRef> = {};
    private temporaryImages = new Set<string>();
    private past: Entry[] = [];
    private future: Entry[] = [];
    private gesture: Entry | null = null;
    private focus = '';
    private run = 0;
    private disposed = false;
    private timer: ReturnType<typeof setTimeout> | undefined;
    private writes = Promise.resolve();
    private pageViews = new Map<
        string,
        { page: Page; summary: PageSummary; assets: Record<string, AssetRef>; value: Page }
    >();
    private loads = new Map<string, Promise<Page>>();
    private lastValid: Record<string, Page> = {};
    private pending: SaveBookDraftBody | null = null;
    private pendingWorking: WorkingBook | null = null;
    private blankSource: Asset | null = null;
    private blankUpload: UploadCheckpoint | null = null;
    private inFlight: Promise<boolean> | null = null;
    private autosavePauses = new Set<string>();
    private controller = new AbortController();
    readonly key: string;
    readonly userId: string;
    readonly bookId: string;
    private deps: Dependencies;
    constructor(userId: string, bookId: string, deps: Dependencies) {
        this.userId = userId;
        this.bookId = bookId;
        this.deps = deps;
        this.key = `${userId}:${bookId}`;
    }
    subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };
    getSnapshot = () => this.state;
    private publish(patch: Partial<DraftState>) {
        this.state = {
            ...this.state,
            ...patch,
            version: this.state.version + 1,
            canUndo: this.past.length > 0,
            canRedo: this.future.length > 0,
        };
        for (const listener of this.listeners) listener();
    }
    activate(id: string) {
        this.focus = id;
    }
    async initialize() {
        this.disposed = false;
        // StrictMode/Suspense reconnect the same provider. Keep its working copy
        // and in-flight page/save requests instead of restarting a book session.
        if (this.state.base) {
            if (this.controller.signal.aborted) this.controller = new AbortController();
            return;
        }
        const run = ++this.run;
        this.controller = new AbortController();
        try {
            const [base, saved] = await Promise.all([
                this.deps.read(this.bookId, this.controller.signal),
                this.deps.storage.read(this.key).catch(() => {
                    this.storageWarning();
                    return null;
                }),
            ]);
            if (this.disposed || run !== this.run) return;
            const parsed = DraftRecordSchema.safeParse(saved);
            const record =
                parsed.success &&
                parsed.data.userId === this.userId &&
                parsed.data.bookId === this.bookId
                    ? parsed.data
                    : null;
            if (saved && !record)
                this.publish({
                    storageWarning:
                        'Bản nháp trên máy không đọc được. Nội dung đã lưu trên máy chủ vẫn còn.',
                });
            this.publish({
                base,
                working: freshWorking(base),
                loading: false,
                recovery: record,
                error: null,
            });
        } catch (cause) {
            if (!this.disposed && run === this.run)
                this.publish({ loading: false, error: this.deps.message(cause) });
        }
    }
    restore() {
        const record = this.state.recovery,
            remote = this.state.base;
        if (!record || !remote) return;
        this.pending = record.pending;
        this.pendingWorking = record.pendingWorking;
        this.blankSource = record.blankSource;
        this.blankUpload = record.blankUpload;
        this.basePages = record.basePages;
        this.assets = record.assets;
        this.temporaryImages = new Set(record.temporaryImages);
        this.lastValid = record.working.overrides;
        this.publish({
            base: record.base,
            editVersion: this.state.editVersion + 1,
            working: record.working,
            recovery: null,
            dirty: workingDirty(record.base, record.working, this.basePages),
            uncertain: Boolean(record.pending),
            conflict: !record.pending && record.base.revision !== remote.revision,
            error:
                record.base.revision !== remote.revision
                    ? 'Sách đã thay đổi trên máy chủ. Bản nháp được khôi phục để bạn đối chiếu; hãy tải bản nháp xuống trước khi đọc lại bản đã lưu.'
                    : null,
        });
    }
    async dismissRecovery() {
        for (const id of this.state.recovery?.temporaryImages || []) this.temporaryImages.add(id);
        void this.cleanupImages();
        this.publish({ recovery: null });
        await this.queueRemove();
    }
    private storageWarning() {
        if (!this.disposed)
            this.publish({
                storageWarning:
                    'Chưa lưu được bản khôi phục trên máy. Hãy bấm Lưu sách để bảo vệ thay đổi.',
            });
    }
    private entry(): Entry {
        return { working: this.materialize(this.state.working as WorkingBook), focus: this.focus };
    }
    private materialize(working: WorkingBook): WorkingBook {
        return {
            ...working,
            overrides: {
                ...Object.fromEntries(
                    working.pages.flatMap((summary) => {
                        const page = this.basePages[summary.id];
                        return page ? [[summary.id, { ...page, ...summary }]] : [];
                    }),
                ),
                ...working.overrides,
            },
        };
    }
    private change(working: WorkingBook) {
        if ((this.state.saving && !this.state.autosaving) || this.disposed)
            throw new Error('Hãy đợi thao tác lưu hoàn tất.');
        if (!this.gesture) {
            this.past = [...this.past.slice(-39), this.entry()];
            this.future = [];
        }
        this.publish({
            working,
            editVersion: this.state.editVersion + 1,
            dirty: workingDirty(this.state.base as BookDraftSnapshot, working, this.basePages),
            notice: null,
            error: this.state.conflict ? this.state.error : null,
        });
        this.checkpoint();
    }
    getPage(id: string): Page | undefined {
        const summary = this.state.working?.pages.find((page) => page.id === id);
        const page = this.state.working?.overrides[id] ?? this.basePages[id];
        if (!summary || !page) return undefined;
        const cached = this.pageViews.get(id);
        if (cached?.page === page && cached.summary === summary && cached.assets === this.assets)
            return cached.value;
        const value = { ...page, ...summary, assets: { ...page.assets, ...this.assets } };
        this.pageViews.set(id, { page, summary, assets: this.assets, value });
        return value;
    }
    async loadPage(id: string): Promise<Page> {
        const local = this.getPage(id);
        if (local) return local;
        if (!this.state.working?.pages.some((page) => page.id === id))
            throw new Error('Trang không còn trong bản nháp.');
        const existing = this.loads.get(id);
        if (existing) return existing;
        const run = this.run;
        const request = this.deps
            .page(id, this.controller.signal)
            .then((page) => {
                if (this.disposed || run !== this.run) throw new Error('Đã đóng bản nháp.');
                if (page.bookId !== this.bookId)
                    throw new Error('Trang không thuộc sách đang chỉnh sửa.');
                this.basePages = { ...this.basePages, [id]: page };
                this.publish({
                    conflict:
                        this.state.conflict || page.revision !== this.state.base?.pageRevisions[id],
                });
                return this.getPage(id) as Page;
            })
            .finally(() => this.loads.delete(id));
        this.loads.set(id, request);
        return request;
    }
    registerAsset(asset: Asset, temporaryImage = false) {
        this.assets = {
            ...this.assets,
            [asset.id]: {
                type: asset.type,
                url: asset.url,
                thumbnailUrl: asset.thumbnailUrl,
                meta: asset.meta,
            },
        };
        if (temporaryImage) this.temporaryImages.add(asset.id);
        this.publish({});
        this.checkpoint();
    }
    addBlankPage(title: string | null = null, after?: string | null) {
        if (!this.deps.blankPageUrl) throw new Error('Chưa chuẩn bị được trang trắng.');
        const dimensions = blankPageDimensions(
            (this.state.base as BookDraftSnapshot).geometry.pageAspect,
        );
        return this.insertPage({ url: this.deps.blankPageUrl, ...dimensions }, title, after, true);
    }
    async addPage(asset: Asset, title: string | null = null, after?: string | null) {
        const aspect = (this.state.base as BookDraftSnapshot).geometry.pageAspect;
        const layout = await this.deps.imageLayout(this.bookId, asset.id, aspect);
        if (aspect !== this.state.base?.geometry.pageAspect)
            throw new Error('Khổ sách đã thay đổi. Hãy thêm trang lại.');
        return this.insertPage({ ...layout, assetId: asset.id }, title, after);
    }
    private insertPage(
        image: Page['image'],
        title: string | null,
        after?: string | null,
        blank = false,
    ) {
        const working = this.state.working as WorkingBook;
        const id = crypto.randomUUID(),
            index =
                after === undefined
                    ? working.pages.length
                    : after === null
                      ? 0
                      : working.pages.findIndex((page) => page.id === after) + 1;
        const page: Page = {
            id,
            bookId: this.bookId,
            orderIndex: index,
            title,
            thumbnailUrl: image.url,
            markerMode: 'NONE',
            markerNumber: null,
            markerScore: null,
            markerWarnings: [],
            objectCount: 0,
            image,
            markerReport: null,
            bookariaMarker: null,
            settings: PageSettingsSchema.parse({}),
            scene: SceneSchema.parse({ schemaVersion: 1, objects: [] }),
            revision: 0,
            assets: {},
            updatedAt: new Date().toISOString(),
        };
        const pages = [...working.pages];
        pages.splice(index, 0, PageSummarySchema.parse(page));
        this.change({
            ...working,
            pages: pages.map((item, orderIndex) => ({ ...item, orderIndex })),
            overrides: { ...working.overrides, [id]: page },
            blankPages: blank ? { ...working.blankPages, [id]: true } : working.blankPages,
        });
        return { page: { id, orderIndex: index, markerMode: page.markerMode, markerNumber: null } };
    }
    async duplicatePage(id: string) {
        const source = await this.loadPage(id),
            working = this.state.working as WorkingBook;
        const nextId = crypto.randomUUID(),
            index = working.pages.findIndex((page) => page.id === id) + 1;
        const copy = {
            ...structuredClone(source),
            id: nextId,
            title: source.title ? `${source.title} (bản sao)`.slice(0, 200) : null,
            revision: 0,
            markerMode: 'NONE' as const,
            markerNumber: null,
            markerScore: null,
            markerWarnings: [],
            bookariaMarker: null,
            markerReport: null,
        };
        const pages = [...working.pages];
        pages.splice(index, 0, PageSummarySchema.parse(copy));
        this.change({
            ...working,
            pages: pages.map((page, orderIndex) => ({ ...page, orderIndex })),
            overrides: { ...working.overrides, [nextId]: copy },
            blankPages: working.blankPages[id]
                ? { ...working.blankPages, [nextId]: true }
                : working.blankPages,
        });
        return { page: copy };
    }
    renamePage(id: string, title: string | null) {
        const working = this.state.working as WorkingBook;
        this.change({
            ...working,
            pages: working.pages.map((page) =>
                page.id === id ? { ...page, title: title?.trim() || null } : page,
            ),
        });
    }
    reorder(ids: string[]) {
        const working = this.state.working as WorkingBook,
            pages = new Map(working.pages.map((page) => [page.id, page]));
        if (
            ids.length !== pages.size ||
            new Set(ids).size !== pages.size ||
            ids.some((id) => !pages.has(id))
        )
            throw new Error('Danh sách trang không hợp lệ.');
        this.change({
            ...working,
            pages: ids.map((id, orderIndex) => ({ ...(pages.get(id) as PageSummary), orderIndex })),
        });
    }
    async removePage(id: string) {
        await this.loadPage(id);
        const working = this.state.working as WorkingBook;
        this.change({
            ...working,
            pages: working.pages
                .filter((page) => page.id !== id)
                .map((page, orderIndex) => ({ ...page, orderIndex })),
        });
    }
    patchPage(id: string, patch: Partial<Page>, mind?: string) {
        const page = this.getPage(id);
        if (!page) throw new Error('Chưa đọc được trang.');
        const working = this.state.working as WorkingBook,
            next = { ...page, ...patch };
        const blankPages = { ...working.blankPages };
        if (patch.image?.assetId && patch.image.assetId !== this.blankSource?.id)
            delete blankPages[id];
        this.change({
            ...working,
            blankPages,
            pages: working.pages.map((summary) =>
                summary.id === id
                    ? {
                          ...summary,
                          ...(patch.title !== undefined ? { title: patch.title } : {}),
                          thumbnailUrl: next.thumbnailUrl,
                          objectCount: next.scene.objects.length,
                      }
                    : summary,
            ),
            overrides: { ...working.overrides, [id]: next },
            minds: mind ? { ...working.minds, [id]: mind } : working.minds,
        });
    }
    setScene(id: string, update: Scene | ((scene: Scene) => Scene)) {
        const page = this.getPage(id);
        if (!page) return;
        const scene = typeof update === 'function' ? update(page.scene) : update;
        this.patchPage(id, { scene, objectCount: scene.objects.length });
    }
    begin() {
        this.gesture ??= this.entry();
    }
    end() {
        if (!this.gesture) return;
        if (
            fingerprint(this.gesture.working) !==
            fingerprint(this.materialize(this.state.working as WorkingBook))
        ) {
            this.past = [...this.past.slice(-39), this.gesture];
            this.future = [];
        }
        this.gesture = null;
        this.publish({});
        this.checkpoint();
    }
    undo(): string {
        this.end();
        const target = this.past.at(-1);
        if (!target || (this.state.saving && !this.state.autosaving)) return this.focus;
        this.past = this.past.slice(0, -1);
        this.future.push(this.entry());
        this.publish({
            working: target.working,
            editVersion: this.state.editVersion + 1,
            dirty: workingDirty(
                this.state.base as BookDraftSnapshot,
                target.working,
                this.basePages,
            ),
            error: null,
        });
        this.checkpoint();
        return target.working.pages.some((page) => page.id === target.focus)
            ? target.focus
            : target.working.pages[0]?.id || '';
    }
    redo(): string {
        const target = this.future.at(-1);
        if (!target || (this.state.saving && !this.state.autosaving)) return this.focus;
        this.future = this.future.slice(0, -1);
        this.past.push(this.entry());
        this.publish({
            working: target.working,
            editVersion: this.state.editVersion + 1,
            dirty: workingDirty(
                this.state.base as BookDraftSnapshot,
                target.working,
                this.basePages,
            ),
            error: null,
        });
        this.checkpoint();
        return target.working.pages.some((page) => page.id === target.focus)
            ? target.focus
            : target.working.pages[0]?.id || '';
    }
    private checkpoint() {
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => {
            void this.flush();
        }, 350);
    }
    async flush() {
        if (this.timer) clearTimeout(this.timer);
        this.timer = undefined;
        const { base, working, recovery } = this.state;
        if (!base || !working || recovery) return;
        if (!this.state.dirty && !this.state.uncertain && !this.pending) return this.queueRemove();
        const safe = safeCheckpoint(this.materialize(working), {
            ...this.basePages,
            ...this.lastValid,
        });
        this.lastValid = safe.overrides;
        const record: DraftRecord = {
            pending: this.pending,
            pendingWorking: this.pendingWorking,
            blankSource: this.blankSource,
            blankUpload: this.blankUpload,
            version: 1,
            userId: this.userId,
            bookId: this.bookId,
            savedAt: new Date().toISOString(),
            base,
            working: safe,
            basePages: this.basePages,
            assets: this.assets,
            temporaryImages: [...this.temporaryImages],
        };
        this.writes = this.writes
            .catch(() => {})
            .then(() => this.deps.storage.write(this.key, record))
            .catch(() => this.storageWarning());
        return this.writes;
    }
    private queueRemove() {
        if (this.timer) clearTimeout(this.timer);
        this.timer = undefined;
        this.writes = this.writes
            .catch(() => {})
            .then(() => this.deps.storage.remove(this.key))
            .catch(() => this.storageWarning());
        return this.writes;
    }
    private accept(result: SaveBookDraftResult) {
        const current = this.materialize(this.state.working as WorkingBook);
        const sent = this.pendingWorking ?? current;
        this.past = this.past.map((entry) => ({
            ...entry,
            working: this.materialize(entry.working),
        }));
        this.future = this.future.map((entry) => ({
            ...entry,
            working: this.materialize(entry.working),
        }));
        const canonical = new Map(result.pages.map((page) => [page.id, page]));
        this.assets = Object.assign({}, this.assets, ...result.pages.map((page) => page.assets));
        const before = this.basePages;
        this.basePages = Object.fromEntries(
            result.snapshot.pages.flatMap((summary) => {
                const page =
                    canonical.get(summary.id) ?? sent.overrides[summary.id] ?? before[summary.id];
                return page &&
                    (canonical.has(summary.id) ||
                        page.revision === result.snapshot.pageRevisions[summary.id])
                    ? [
                          [
                              summary.id,
                              {
                                  ...page,
                                  ...summary,
                                  revision: result.snapshot.pageRevisions[summary.id],
                              },
                          ],
                      ]
                    : [];
            }),
        );
        const working = rebaseSavedBook(current, sent, result.snapshot, this.basePages);
        const dirty = workingDirty(result.snapshot, working, this.basePages);
        this.pending = null;
        this.pendingWorking = null;
        this.lastValid = { ...this.basePages, ...this.lastValid };
        this.publish({
            base: result.snapshot,
            working,
            dirty,
            conflict: false,
            uncertain: false,
            error: null,
            notice: this.state.autosaving
                ? null
                : dirty
                  ? 'Đã lưu phần đã gửi. Các thay đổi mới vẫn được giữ trong bản nháp.'
                  : 'Đã lưu sách.',
            jobs: result.jobs,
        });
        if (dirty) void this.flush();
        else void this.queueRemove();
    }
    setAutosavePaused(key: string, paused: boolean) {
        const changed = paused ? !this.autosavePauses.has(key) : this.autosavePauses.has(key);
        if (paused) this.autosavePauses.add(key);
        else this.autosavePauses.delete(key);
        if (changed) for (const listener of this.listeners) listener();
    }
    canAutosave(allowCurrentSave = false) {
        if (
            this.disposed ||
            this.state.loading ||
            this.state.recovery ||
            !this.state.dirty ||
            this.state.conflict ||
            this.state.uncertain ||
            this.state.error ||
            this.gesture ||
            this.autosavePauses.size ||
            (this.state.saving && !allowCurrentSave)
        )
            return false;
        try {
            return draftChanges(
                this.state.base as BookDraftSnapshot,
                this.state.working as WorkingBook,
                this.basePages,
            ).every((change) => !change.scene || SceneSchema.safeParse(change.scene).success);
        } catch {
            return false;
        }
    }
    private async prepareBlankPages() {
        const working = this.state.working as WorkingBook;
        if (
            !working.pages.some(
                (page) => working.blankPages[page.id] && !this.getPage(page.id)?.image.assetId,
            )
        )
            return;
        if (!this.blankSource) {
            if (!this.deps.prepareBlankImage)
                throw new Error('Chưa tải được ảnh trang trắng. Hãy thử lưu lại.');
            const asset = await this.deps.prepareBlankImage(
                (this.state.base as BookDraftSnapshot).geometry.pageAspect,
                this.blankUpload,
                (checkpoint) => {
                    this.blankUpload = checkpoint;
                    this.temporaryImages.add(checkpoint.signature.assetId);
                    void this.flush();
                },
                this.controller.signal,
            );
            this.blankSource = asset;
            this.blankUpload = null;
            this.registerAsset(asset, true);
        }
        const current = this.state.working as WorkingBook,
            overrides = { ...current.overrides };
        for (const summary of current.pages) {
            const page = this.getPage(summary.id);
            if (current.blankPages[summary.id] && page && !page.image.assetId)
                overrides[summary.id] = {
                    ...page,
                    image: { ...page.image, assetId: this.blankSource.id },
                };
        }
        this.publish({ working: { ...current, overrides } });
        await this.flush();
    }
    async save(mode: 'manual' | 'auto' = 'manual', ready?: () => boolean): Promise<boolean> {
        if (this.inFlight) {
            if (mode === 'auto') return false;
            await this.inFlight;
            return this.state.dirty
                ? this.save('manual')
                : !this.state.conflict && !this.state.uncertain;
        }
        const operation = this.performSave(mode, ready);
        this.inFlight = operation;
        try {
            return await operation;
        } finally {
            if (this.inFlight === operation) this.inFlight = null;
        }
    }
    private async performSave(mode: 'manual' | 'auto', ready?: () => boolean): Promise<boolean> {
        if (this.state.saving) return false;
        if (!this.state.dirty) return true;
        if (this.state.conflict || this.state.uncertain) {
            this.publish({
                error: 'Hãy kiểm tra phiên bản trên máy chủ trước khi lưu lại. Bản nháp vẫn được giữ.',
            });
            return false;
        }
        const run = this.run;
        let sentToServer = false;
        try {
            this.end();
            this.publish({ saving: true, autosaving: mode === 'auto', error: null, notice: null });
            const initialChanges = draftChanges(
                this.state.base as BookDraftSnapshot,
                this.state.working as WorkingBook,
                this.basePages,
            );
            for (const change of initialChanges)
                if (change.scene && !SceneSchema.safeParse(change.scene).success)
                    throw new Error(
                        `Trang ${(this.state.working as WorkingBook).pages.findIndex((page) => page.id === change.id) + 1}: thông số chưa hợp lệ. Hãy kiểm tra trang này trước khi lưu sách.`,
                    );
            await this.prepareBlankPages();
            if (this.disposed || (mode === 'auto' && ready && !ready())) return false;
            if (!this.state.dirty) return true;
            const base = this.state.base as BookDraftSnapshot,
                working = this.state.working as WorkingBook;
            const changes = draftChanges(base, working, this.basePages);
            for (const change of changes)
                if (change.scene && !SceneSchema.safeParse(change.scene).success)
                    throw new Error(
                        `Trang ${working.pages.findIndex((page) => page.id === change.id) + 1}: thông số chưa hợp lệ. Hãy kiểm tra trang này trước khi lưu sách.`,
                    );
            this.pending = SaveBookDraftBodySchema.parse({
                revision: base.revision,
                order: working.pages.map((page) => page.id),
                changes,
            });
            this.pendingWorking = this.materialize(working);
            await this.flush();
            if (this.disposed || (mode === 'auto' && ready && !ready())) {
                this.pending = null;
                this.pendingWorking = null;
                await this.flush();
                return false;
            }
            sentToServer = true;
            const result = await this.deps.save(this.bookId, this.pending);
            if (run !== this.run) return false;
            this.accept(result);
            return true;
        } catch (cause) {
            if (run === this.run) {
                if (!sentToServer || !this.deps.uncertain(cause)) {
                    this.pending = null;
                    this.pendingWorking = null;
                }
                this.publish({
                    error: this.deps.message(cause),
                    conflict: this.deps.conflict(cause),
                    uncertain: sentToServer && this.deps.uncertain(cause),
                });
            }
            return false;
        } finally {
            if (run === this.run) {
                this.publish({ saving: false, autosaving: false });
                if (this.state.dirty) void this.flush();
            }
        }
    }
    async readLatest(replace: boolean) {
        if (this.state.saving) return;
        this.publish({ saving: true, error: null });
        try {
            const snapshot = await this.deps.read(this.bookId, this.controller.signal);
            if (replace) {
                const current = snapshot.pages.some((page) => page.id === this.focus)
                    ? await this.deps.page(this.focus, this.controller.signal)
                    : null;
                this.basePages = current ? { [current.id]: current } : {};
                this.lastValid = this.basePages;
                this.assets = {};
                this.past = [];
                this.future = [];
                this.pending = null;
                this.pendingWorking = null;
                this.publish({
                    base: snapshot,
                    working: freshWorking(snapshot),
                    dirty: false,
                    conflict: false,
                    uncertain: false,
                    notice: 'Đã đọc bản sách trên máy chủ.',
                });
                await this.queueRemove();
            } else if (this.pending && snapshot.revision === this.pending.revision) {
                this.pending = null;
                this.pendingWorking = null;
                this.publish({
                    uncertain: false,
                    notice: 'Máy chủ chưa ghi nhận thay đổi. Bạn có thể bấm Lưu sách lại.',
                });
            } else if (this.pending) {
                // Repeat the same optimistic request: the server recognizes an already committed snapshot.
                this.accept(await this.deps.save(this.bookId, this.pending));
            } else if (!this.state.dirty) {
                const current = snapshot.pages.some((page) => page.id === this.focus)
                    ? await this.deps.page(this.focus, this.controller.signal)
                    : null;
                this.basePages = current ? { [current.id]: current } : {};
                this.lastValid = this.basePages;
                this.publish({ base: snapshot, working: freshWorking(snapshot), conflict: false });
            } else if (snapshot.revision !== this.state.base?.revision)
                this.publish({ conflict: true });
        } catch (cause) {
            if (!this.disposed)
                this.publish({
                    error: this.deps.message(cause),
                    conflict: this.state.conflict || this.deps.conflict(cause),
                });
        } finally {
            this.publish({ saving: false, autosaving: false });
        }
    }
    /** Called only after the user explicitly chooses to discard and leave. */
    async abandon() {
        if (this.inFlight) {
            this.setAutosavePaused('leave', true);
            try {
                await this.inFlight;
            } finally {
                this.setAutosavePaused('leave', false);
            }
        }
        if (this.state.base)
            this.state = {
                ...this.state,
                working: freshWorking(this.state.base),
                dirty: false,
                uncertain: false,
            };
        this.pending = null;
        this.pendingWorking = null;
        void this.queueRemove();
        void this.cleanupImages();
    }
    async discard() {
        await this.readLatest(true);
    }
    private async cleanupImages() {
        const used = new Set(Object.values(this.basePages).map((page) => page.image.assetId));
        for (const id of [...this.temporaryImages]) {
            if (used.has(id)) {
                this.temporaryImages.delete(id);
                continue;
            }
            try {
                await this.deps.removeAsset(id);
                this.temporaryImages.delete(id);
            } catch {
                /* Server protects images still referenced by another page or publication. */
            }
        }
    }
    exportDraft() {
        return {
            version: 1,
            bookId: this.bookId,
            base: this.state.base,
            working: this.materialize(this.state.working as WorkingBook),
            assets: this.assets,
        };
    }
    dispose() {
        void this.flush();
        if (
            !this.state.dirty &&
            !this.state.recovery &&
            !this.state.saving &&
            !this.pending &&
            !this.state.uncertain
        )
            void this.cleanupImages();
        this.disposed = true;
        const controller = this.controller;
        queueMicrotask(() => {
            if (this.disposed || controller !== this.controller) controller.abort();
        });
        if (this.timer) clearTimeout(this.timer);
    }
}
