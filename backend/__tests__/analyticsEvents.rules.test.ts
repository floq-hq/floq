// M7.2 analytics_events: always-on, create-only, uid-linked, strict shape.
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import {
  setupEnv, teardownEnv, clear, authed, unauthed, seed, assertSucceeds, assertFails,
} from './_setup';

const A = 'alice';

function event(overrides: Record<string, unknown> = {}) {
  return { uid: A, name: 'invite_created', ts: 1700000000000, seq: 1, kind: '', props: {}, ...overrides };
}

beforeAll(setupEnv);
afterAll(teardownEnv);
beforeEach(clear);

describe('analytics_events rules', () => {
  it('AE1: create with uid == self', async () => {
    await assertSucceeds(setDoc(doc(authed(A), 'analytics_events', `${A}:1`), event()));
  });

  it('AE2: uid-spoof denied', async () => {
    await assertFails(setDoc(doc(authed(A), 'analytics_events', `${A}:1`), event({ uid: 'bob' })));
  });

  it('AE3: unauthenticated create denied', async () => {
    await assertFails(setDoc(doc(unauthed(), 'analytics_events', 'x:1'), event({ uid: 'x' })));
  });

  it('AE4: extra key denied', async () => {
    await assertFails(setDoc(doc(authed(A), 'analytics_events', `${A}:1`), event({ extra: true })));
  });

  it('AE5: missing key denied (hasAll)', async () => {
    const { props, ...noProps } = event();
    void props;
    await assertFails(setDoc(doc(authed(A), 'analytics_events', `${A}:1`), noProps));
  });

  it('AE6: name too long denied', async () => {
    await assertFails(setDoc(doc(authed(A), 'analytics_events', `${A}:1`), event({ name: 'x'.repeat(65) })));
  });

  it('AE7: empty name denied', async () => {
    await assertFails(setDoc(doc(authed(A), 'analytics_events', `${A}:1`), event({ name: '' })));
  });

  it('AE8: props not a map denied', async () => {
    await assertFails(setDoc(doc(authed(A), 'analytics_events', `${A}:1`), event({ props: 'x' })));
  });

  it('AE9: props over the 16-key cap denied', async () => {
    const big: Record<string, number> = {};
    for (let i = 0; i < 17; i++) big[`k${i}`] = i;
    await assertFails(setDoc(doc(authed(A), 'analytics_events', `${A}:1`), event({ props: big })));
  });

  it('AE10: non-number ts denied', async () => {
    await assertFails(setDoc(doc(authed(A), 'analytics_events', `${A}:1`), event({ ts: 'now' })));
  });

  it('AE11: read denied', async () => {
    await seed((db) => setDoc(doc(db, 'analytics_events', `${A}:1`), event()));
    await assertFails(getDoc(doc(authed(A), 'analytics_events', `${A}:1`)));
  });

  it('AE12: re-create of an existing event denied (the idempotency proof)', async () => {
    await seed((db) => setDoc(doc(db, 'analytics_events', `${A}:1`), event()));
    // a retry hits the same id → create-on-existing → update → denied (recorded once)
    await assertFails(setDoc(doc(authed(A), 'analytics_events', `${A}:1`), event()));
  });

  it('AE13: delete denied', async () => {
    await seed((db) => setDoc(doc(db, 'analytics_events', `${A}:1`), event()));
    await assertFails(deleteDoc(doc(authed(A), 'analytics_events', `${A}:1`)));
  });

  it('AE14: update denied', async () => {
    await seed((db) => setDoc(doc(db, 'analytics_events', `${A}:1`), event()));
    await assertFails(updateDoc(doc(authed(A), 'analytics_events', `${A}:1`), { name: 'changed' }));
  });
});
