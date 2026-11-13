"use strict";

// Room storage seam.
//
// Everything in the game engine talks to rooms through this interface, so the
// backing store can move from process memory to Redis without touching game
// logic. The interface deliberately mirrors the subset of the Map API the
// server already uses: get, set, has, delete, values, size, clear.
//
// A Redis implementation must keep the same method names and return the same
// shapes. Rooms are mutated in place by the engine, so a Redis-backed store
// will need to serialise on write and rehydrate on read; that is the one
// behavioural difference to plan for when the swap happens.

function createMemoryRoomStore() {
  const rooms = new Map();

  return {
    get(code) {
      return rooms.get(code) || null;
    },
    set(code, room) {
      rooms.set(code, room);
      return room;
    },
    has(code) {
      return rooms.has(code);
    },
    delete(code) {
      return rooms.delete(code);
    },
    values() {
      return rooms.values();
    },
    // Snapshot of every live room. Used by diagnostics and by tests that need
    // to assert a room was actually removed rather than merely unreachable.
    list() {
      return [...rooms.values()];
    },
    entries() {
      return rooms.entries();
    },
    get size() {
      return rooms.size;
    },
    clear() {
      rooms.clear();
    }
  };
}

module.exports = { createMemoryRoomStore };
