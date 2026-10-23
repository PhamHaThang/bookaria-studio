import assert from 'node:assert/strict';
import { test } from 'node:test';
import axios from 'axios';
import { AuditIdSchema, createAdminOperationsApi } from '../src/features/admin/operations-api.ts';
import {
    auditTargetLink,
    canRetryJob,
    formSearch,
    operationsKeys,
    readAuditSearch,
    readJobsSearch,
} from '../src/features/admin/operations-model.ts';
import { ContractError } from '../src/shared/api/contract.ts';

const id = '11111111-1111-4111-8111-111111111111',
    other = '22222222-2222-4222-8222-222222222222';
const job = {
    id,
    type: 'BUILD_PREVIEW',
    status: 'FAILED',
    progress: 0,
    attempts: 3,
    ref: { type: 'BOOK', id: other },
    result: null,
    error: { code: 'PREVIEW_STALE', message: 'Draft changed' },
    createdBy: { id, displayName: 'An' },
    createdAt: '2026-10-23T00:00:00.000Z',
    finishedAt: '2026-10-23T00:00:01.000Z',
};
const log = {
    id: 7,
    actor: { id, displayName: 'An' },
    action: 'RETRY_JOB',
    target: { type: 'JOB', id },
    detail: { previousJobId: id, newJobId: other },
    createdAt: job.createdAt,
};
const paged = (data) => ({
    data,
    meta: { page: 1, limit: 12, total: data.length, totalPages: data.length ? 1 : 0 },
});
function fixture(data, status = 200) {
    const state = { data, status, calls: [] };
    const api = createAdminOperationsApi(
        axios.create({
            adapter: async (config) => {
                state.calls.push(config);
                return {
                    config,
                    data: state.data,
                    status: state.status,
                    statusText: 'OK',
                    headers: {},
                };
            },
        }),
    );
    return { api, state };
}

test('operations filters preserve valid predicates and refuse malformed URL predicates', () => {
    const jobs = readJobsSearch(new URLSearchParams('page=2&status=FAILED&type=BUILD_PREVIEW'));
    assert.equal(jobs.success, true);
    assert.deepEqual(jobs.data, { page: 2, limit: 12, status: 'FAILED', type: 'BUILD_PREVIEW' });
    for (const url of ['status=fail', 'type=pdf', 'page=-1', 'page=1.2'])
        assert.equal(readJobsSearch(new URLSearchParams(url)).success, false);
    assert.equal(
        readAuditSearch(
            new URLSearchParams(`action=RETRY_JOB&actorId=${id}&targetType=JOB&targetId=${other}`),
        ).success,
        true,
    );
    for (const url of ['action=DELETE_USER', 'actorId=bad', 'targetId=1', 'targetType=PAGE'])
        assert.equal(readAuditSearch(new URLSearchParams(url)).success, false);
});

test('form submission removes old page and trims selected predicates; actor keys cannot share results', () => {
    const form = new FormData();
    form.set('actorId', ` ${id} `);
    form.set('targetId', '');
    form.set('page', '50');
    assert.equal(formSearch(form, ['actorId', 'targetId']).toString(), `actorId=${id}`);
    assert.notDeepEqual(operationsKeys.jobs(id, {}), operationsKeys.jobs(other, {}));
    assert.notDeepEqual(operationsKeys.audit(id, {}), operationsKeys.audit(other, {}));
    assert.notDeepEqual(operationsKeys.auditLog(id, 7), operationsKeys.auditLog(other, 7));
    assert.equal(auditTargetLink('JOB', id), `/admin/audit-logs?targetType=JOB&targetId=${id}`);
});

test('manual retry eligibility does not confuse three worker attempts with a manual limit', () => {
    assert.equal(canRetryJob(job), true);
    for (const status of ['QUEUED', 'RUNNING', 'SUCCEEDED'])
        assert.equal(canRetryJob({ ...job, status }), false);
    assert.equal(canRetryJob({ ...job, createdBy: null }), false);
});

test('job list checks backend DTO, pagination, predicates and cancellation', async () => {
    const { api, state } = fixture(paged([job])),
        signal = new AbortController().signal;
    assert.deepEqual((await api.jobs({ status: 'FAILED', type: 'BUILD_PREVIEW' }, signal)).data, [
        job,
    ]);
    assert.equal(state.calls[0].url, '/admin/jobs');
    assert.equal(state.calls[0].signal, signal);
    assert.equal(state.calls[0].params.status, 'FAILED');
    state.data = paged([{ ...job, attempts: 4 }]);
    await assert.rejects(() => api.jobs({}), ContractError);
    state.data = { data: [job] };
    await assert.rejects(() => api.jobs({}), ContractError);
});

test('invalid API predicates and identifiers cannot send HTTP requests', async () => {
    const { api, state } = fixture({});
    for (const run of [
        () => api.jobs({ status: 'oops' }),
        () => api.audit({ targetId: 'bad' }),
        () => api.retry('bad'),
        () => api.auditLog(-1),
        () => api.auditLog(1.2),
    ])
        await assert.rejects(run);
    assert.equal(state.calls.length, 0);
});

test('retry requires202 and a distinct valid new identity; no automatic second POST', async () => {
    const { api, state } = fixture({ data: { jobId: other } }, 202);
    assert.deepEqual(await api.retry(id), { jobId: other });
    assert.equal(state.calls[0].url, `/admin/jobs/${id}/retry`);
    assert.equal(state.calls[0].method, 'post');
    state.data = { data: { jobId: id.toUpperCase() } };
    await assert.rejects(() => api.retry(id), ContractError);
    state.data = { data: { jobId: other } };
    state.status = 200;
    await assert.rejects(() => api.retry(id), ContractError);
    state.status = 202;
    state.data = { data: { jobId: 'bad' } };
    await assert.rejects(() => api.retry(id), ContractError);
    assert.equal(state.calls.length, 4);
});

test('audit list validates all audit fields and supports nullable historical detail', async () => {
    const { api, state } = fixture(paged([{ ...log, detail: null }])),
        signal = new AbortController().signal;
    const result = await api.audit(
        { action: 'RETRY_JOB', actorId: id, targetType: 'JOB', targetId: id },
        signal,
    );
    assert.equal(result.data[0].detail, null);
    assert.equal(state.calls[0].url, '/admin/audit-logs');
    assert.equal(state.calls[0].signal, signal);
    assert.equal(state.calls[0].params.actorId, id);
    state.data = paged([{ ...log, action: 'UNKNOWN_ACTION' }]);
    await assert.rejects(() => api.audit({}), ContractError);
});

test('audit detail enforces integer ID, matching response identity and200', async () => {
    const { api, state } = fixture({ data: log }),
        signal = new AbortController().signal;
    assert.deepEqual(await api.auditLog(7, signal), log);
    assert.equal(state.calls[0].url, '/admin/audit-logs/7');
    assert.equal(state.calls[0].signal, signal);
    state.data = { data: { ...log, id: 8 } };
    await assert.rejects(() => api.auditLog(7), ContractError);
    state.data = { data: log };
    state.status = 202;
    await assert.rejects(() => api.auditLog(7), ContractError);
    for (const value of ['', 'bad', '1.5', '0', '-1', '9007199254740992', id])
        assert.equal(AuditIdSchema.safeParse(value).success, false);
    assert.equal(AuditIdSchema.parse('7'), 7);
});
