/* Room label forms for the 2D plan canvas (Designer-owned, F3-T2). Canvas labels only: readout, summary and lists keep
   the full names of PC.levels.roomNames. `full` equals PC.C.ROOM_LABEL; numbers follow the full name with a space in
   full and short ("Bedroom 2", "Bed 2") and without one in tiny ("B2").
   Rule (stage-plans.js): tiers full + area line -> full -> short -> tiny; every room of a type on a level (the master
   counts as a bedroom) uses the lowest tier any of them needs; the area line for all of a type or none; full and
   short in palette2d.font.room, tiny may use font.roomSmall. */
(function (PC) {
  'use strict';
  PC.data.roomLabels = {
    bedroom: { full: 'Bedroom', short: 'Bed', tiny: 'B' },
    master: { full: 'Master bedroom', short: 'M. bed', tiny: 'MB' },
    bathroom: { full: 'Bathroom', short: 'Bath', tiny: 'Ba' },
    kitchen: { full: 'Kitchen', short: 'Kit', tiny: 'K' },
    living: { full: 'Living', short: 'Liv', tiny: 'L' },
    dining: { full: 'Dining', short: 'Din', tiny: 'D' },
    majlis: { full: 'Majlis', short: 'Maj', tiny: 'Mj' },
    office: { full: 'Office', short: 'Off', tiny: 'O' },
    maid: { full: "Maid's room", short: 'Maid', tiny: 'Md' },
    storage: { full: 'Storage', short: 'Stor', tiny: 'Sto' },
    laundry: { full: 'Laundry', short: 'Ldry', tiny: 'Ln' },
    stair: { full: 'Stairs', short: 'Stair', tiny: 'St' },
    lift: { full: 'Lift', short: 'Lift', tiny: 'Lf' }
  };
})(globalThis.PC = globalThis.PC || {});
