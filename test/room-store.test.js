const test = require("node:test");
const assert = require("node:assert/strict");
const { createMemoryRoomStore } = require("../server/store/room-store.js");

test("the room store exposes the documented interface", () => {
  const store = createMemoryRoomStore();
  for (const method of ["get", "set", "has", "delete", "list", "values", "clear"]) {
    assert.equal(typeof store[method], "function", `${method} must be a function`);
  }
  assert.equal(store.size, 0);
});

test("the room store keeps, lists and deletes rooms", () => {
  const store = createMemoryRoomStore();
  const room = { code: "ABC234", players: new Map() };

  assert.equal(store.get("ABC234"), null, "a missing code returns null, not undefined");
  store.set("ABC234", room);

  assert.equal(store.has("ABC234"), true);
  assert.equal(store.get("ABC234"), room);
  assert.equal(store.size, 1);
  assert.deepEqual(store.list(), [room]);
  assert.deepEqual([...store.values()], [room]);

  assert.equal(store.delete("ABC234"), true);
  assert.equal(store.delete("ABC234"), false);
  assert.equal(store.get("ABC234"), null);
  assert.equal(store.size, 0);
  assert.deepEqual(store.list(), []);
});

test("two stores are independent, so tests cannot leak rooms into each other", () => {
  const first = createMemoryRoomStore();
  const second = createMemoryRoomStore();

  first.set("ABC234", { code: "ABC234" });

  assert.equal(first.has("ABC234"), true);
  assert.equal(second.has("ABC234"), false);
});
