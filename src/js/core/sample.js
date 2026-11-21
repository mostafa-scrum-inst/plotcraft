/* PC.sample: the sample project of the PM stories file, 6.2. Everything not listed there is the 4.1 default. */
(function (PC) {
  'use strict';
  PC.sample = {
    state: function () {
      var s = PC.store.defaults(), a = s.ans, r = PC.store.room;
      s.sampleClean = true;
      s.plot = { pts: [[0, 0], [20, 0], [20, 30], [8, 30], [0, 26]], closed: true };   // counter-clockwise, 584 m2
      a.footprintPct = 25; a.vegPct = 25;
      a.streetEdge = 0;                                   // bottom edge (0,0)-(20,0)
      a.rooms = [
        // Ground: 42 + 24 + 16 + 14 + 6 + 4 + 4 = 110 m2
        r('r1', 'living', 'G', 'L'), r('r2', 'majlis', 'G', 'M'), r('r3', 'dining', 'G', 'M'), r('r4', 'kitchen', 'G', 'M'),
        r('r5', 'maid', 'G', 'S'), r('r6', 'bathroom', 'G', 'S'), r('r7', 'laundry', 'G', 'S'),
        // First: 24 + 16 + 16 + 30 + 12 + 6 + 6 = 110 m2
        r('r8', 'bedroom', '1', 'L', true), r('r9', 'bedroom', '1', 'M'), r('r10', 'bedroom', '1', 'M'),
        r('r11', 'living', '1', 'M'), r('r12', 'office', '1', 'M'), r('r13', 'bathroom', '1', 'M'), r('r14', 'bathroom', '1', 'M')
      ];
      a.nextRoomId = 15;
      a.pairs = [['r3', 'r4'], ['r8', 'r13']];            // Kitchen + Dining; Master bedroom + Bathroom 1
      a.parking = { cars: 2, covered: true };
      a.pool = { on: true, size: 'S' };
      a.extras = { wall: true, gate: 'centre', seating: true };
      return s;
    }
  };
})(globalThis.PC = globalThis.PC || {});
