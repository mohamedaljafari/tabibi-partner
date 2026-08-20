// موك CJS لـ AsyncStorage يشارك الحالة بين كل المستهلكين عبر require.cache
// (نفس سلوك vi.mock الموحد لكن دون كسر تحليل الاستيرادات)
let sharedStore = require.cache["__mock-async-storage-map__"];
if (!sharedStore) {
  sharedStore = { exports: { store: new Map() } };
  require.cache["__mock-async-storage-map__"] = sharedStore;
}
const store = sharedStore.exports.store;
module.exports = {
  getItem: (k) => Promise.resolve(store.get(k) ?? null),
  setItem: (k, v) => { store.set(k, v); return Promise.resolve(); },
  removeItem: (k) => { store.delete(k); return Promise.resolve(); },
  getAllKeys: () => Promise.resolve(Array.from(store.keys())),
  clear: () => { store.clear(); return Promise.resolve(); },
  __sharedStore: store,
};
