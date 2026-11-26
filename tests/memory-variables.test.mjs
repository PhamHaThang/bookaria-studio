import assert from 'node:assert/strict';
import test from 'node:test';
import {
    memoryDefinitions,
    memoryOperations,
    memorySummary,
    memoryUses,
    selectMemory,
} from '../src/features/scene/model/memory-variables.ts';
import { SceneSchema, WorkflowVariablesSchema } from '../src/shared/contracts/scene.schema.ts';

const definition = {
    key: 'state_mission',
    name: 'Đã khám phá',
    type: 'boolean',
    initialValue: false,
};
const remember = { type: 'setState', key: 'score', operation: 'increment', value: 5 };
test('named memory uses stable identity and infers legacy variables across pages', () => {
    const scene = SceneSchema.parse({
        schemaVersion: 1,
        objects: [],
        interactions: [
            {
                id: 'flow',
                trigger: { type: 'onPageEnter' },
                actions: [
                    remember,
                    { ...remember, key: definition.key, operation: 'set', value: true },
                ],
            },
        ],
    });
    const definitions = memoryDefinitions([definition], [scene]);
    assert.equal(definitions.length, 2);
    assert.equal(definitions.find((item) => item.key === 'score').name, 'Điểm số');
    const renamed = { ...definition, name: 'Đã tìm khủng long' };
    const selected = selectMemory(remember, renamed);
    assert.deepEqual(selected, { ...remember, key: definition.key, operation: 'set', value: true });
    assert.match(memorySummary(selected, [renamed]), /Đã tìm khủng long/);
    assert.equal(memoryUses(definition.key, [{ id: 'page', title: 'Trang 1', scene }]).length, 1);
    assert.deepEqual(
        memoryOperations(definition).map((item) => item.value),
        ['set', 'toggle'],
    );
    assert.deepEqual(
        memoryOperations({ ...definition, type: 'string', initialValue: '' }).map(
            (item) => item.value,
        ),
        ['set'],
    );
});
test('memory definitions validate unique normalized names, keys, and matching initial values', () => {
    assert.equal(
        WorkflowVariablesSchema.safeParse([
            definition,
            { ...definition, key: 'other', name: 'đã khám phá' },
        ]).success,
        false,
    );
    assert.equal(
        WorkflowVariablesSchema.safeParse([definition, { ...definition, name: 'Khác' }]).success,
        false,
    );
    assert.equal(
        WorkflowVariablesSchema.safeParse([{ ...definition, initialValue: 0 }]).success,
        false,
    );
    assert.equal(
        WorkflowVariablesSchema.safeParse([{ ...definition, name: '  Đã khám phá  ' }]).data[0]
            .name,
        'Đã khám phá',
    );
});
