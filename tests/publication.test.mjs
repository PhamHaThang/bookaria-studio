import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPublicationApi } from '../src/features/publication/api/publication-api.ts';
import {
    existingJob,
    jobOutcome,
    TaskSchema,
    taskKey,
    uncertainRequest,
} from '../src/features/publication/model/job.ts';

const bookId = '11111111-1111-4111-8111-111111111111';
const jobId = '22222222-2222-4222-8222-222222222222';
test('publication requests validate backend bodies before HTTP; publish and print require 202', async () => {
    const calls = [];
    const api = createPublicationApi({
        post: async (...args) => {
            calls.push(args);
            return { status: 202, data: { data: { jobId } } };
        },
    });
    await assert.rejects(api.publish(bookId, { visibility: 'PRIVATE' }));
    await assert.rejects(api.print(bookId, { bleedMm: 11 }));
    await assert.rejects(api.print(bookId, { bleedMm: Number.NaN }));
    assert.equal(calls.length, 0);
    assert.deepEqual(await api.publish(bookId, { visibility: 'UNLISTED' }), { jobId });
    assert.deepEqual(calls[0], [
        `/books/${bookId}/publish`,
        { visibility: 'UNLISTED', acceptWarnings: false },
    ]);
    await api.print(bookId, { kind: 'MARKER_SHEET', bleedMm: 0 });
    assert.deepEqual(calls[1][1], { kind: 'MARKER_SHEET', qrMode: 'COVER_ONLY', bleedMm: 0 });
    const wrong = createPublicationApi({
        post: async () => ({ status: 200, data: { data: { jobId } } }),
    });
    await assert.rejects(wrong.publish(bookId, { visibility: 'PUBLIC' }));
    await assert.rejects(wrong.print(bookId, {}));
});
test('publication reads reject schema drift and use the author-owned book paths', async () => {
    const calls = [];
    const api = createPublicationApi({
        get: async (url) => {
            calls.push(url);
            return {
                status: 200,
                data: { data: url.endsWith('versions') ? [] : { canPublish: true } },
            };
        },
    });
    assert.deepEqual(await api.versions(bookId), []);
    await assert.rejects(api.check(bookId));
    await assert.rejects(api.share(bookId));
    await assert.rejects(api.versions('../other'));
    assert.equal(calls.length, 3);
});
test('polling verifies job identity, type and book before accepting any result', () => {
    const task = { type: 'EXPORT_PDF', jobId, versionNo: 2 };
    const job = {
        id: jobId,
        type: 'EXPORT_PDF',
        ref: { type: 'BOOK', id: bookId },
        status: 'SUCCEEDED',
        result: { url: 'https://example.com/pdf', kind: 'MARKER_SHEET' },
    };
    assert.deepEqual(jobOutcome(task, bookId, job), {
        type: 'EXPORT_PDF',
        url: 'https://example.com/pdf',
        kind: 'MARKER_SHEET',
        versionNo: 2,
    });
    for (const bad of [
        { ...job, id: bookId },
        { ...job, type: 'PUBLISH_BOOK' },
        { ...job, ref: { type: 'PAGE', id: bookId } },
        { ...job, ref: { type: 'BOOK', id: jobId } },
        { ...job, result: { url: 'javascript:alert(1)', kind: 'PRINT' } },
    ])
        assert.throws(() => jobOutcome(task, bookId, bad));
    assert.equal(jobOutcome(task, bookId, { ...job, status: 'RUNNING' }), null);
});
test('409 adopts only validated job IDs; missing responses and server errors stay uncertain', () => {
    const conflict = {
        response: {
            status: 409,
            data: {
                error: {
                    code: 'JOB_IN_PROGRESS',
                    message: 'Running',
                    requestId: 'request',
                    details: { jobId },
                },
            },
        },
    };
    assert.equal(existingJob(conflict), jobId);
    assert.equal(
        existingJob({
            response: {
                data: {
                    ...conflict.response.data,
                    error: { ...conflict.response.data.error, details: { jobId: '../wrong' } },
                },
            },
        }),
        null,
    );
    assert.equal(uncertainRequest(new Error('Disconnected')), true);
    assert.equal(uncertainRequest({ response: { status: 500 } }), true);
    assert.equal(uncertainRequest(conflict), false);
    assert.equal(uncertainRequest({ response: { status: 422 } }), false);
    assert.notEqual(taskKey('author-a', bookId), taskKey('author-b', bookId));
    assert.equal(
        TaskSchema.safeParse({ type: 'BUILD_PREVIEW', jobId, versionNo: null }).success,
        false,
    );
});
