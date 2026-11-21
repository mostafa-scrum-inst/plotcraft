/* 2D drawing palette (Designer-owned, F1-T1). sRGB strings usable directly as canvas styles.
   All line widths, dash lengths and font sizes are CSS pixels. */
(function (PC) {
  'use strict';
  PC.data.palette2d = {
    canvas: '#FBFAF6',
    grid: { minor: '#E1E3E0', major: '#AEB7BB', label: '#46535F', bounds: '#7C8791' },
    plot: { fill: 'rgba(27,79,143,0.08)', stroke: '#16212B', open: '#16212B', live: '#1B4F8F' },
    vertex: { fill: '#FFFFFF', stroke: '#1B4F8F', first: '#C2410C', active: '#C2410C' },
    label: { text: '#16212B', halo: '#FBFAF6', muted: '#46535F' },
    edge: { front: '#1B4F8F', back: '#46535F', side: '#7C8791', focus: '#C2410C' },   // focus: edge highlighted from the Q6 edge list (F2-T3)
    setback: { fill: 'rgba(168,35,28,0.10)', line: '#A8231C' },
    buildable: { line: '#1C6B46' },
    footprint: { fill: 'rgba(27,79,143,0.16)', stroke: '#1B4F8F' },
    hall: '#EFEDE6',
    stair: '#C5CBD0',
    lift: '#AEB7BB',
    coreLine: '#46535F',
    parking: { fill: '#E3E1DA', stroke: '#46535F' },
    pool: { fill: '#BFE0EE', stroke: '#1B4F8F' },
    north: { stroke: '#16212B', fill: '#16212B', text: '#16212B' },
    room: {
      stroke: '#16212B',
      bedroom: '#D6E2F3', bathroom: '#C9EBE6', kitchen: '#F7E7B0', living: '#DCEBC8', dining: '#F6D9BF',
      majlis: '#E6D6EE', office: '#E6E3C4', maid: '#F4D6DC', storage: '#DEDAD3', laundry: '#CDE6F5'
    },
    state: {
      selection: '#C2410C', handleFill: '#FFFFFF', invalidFill: 'rgba(168,35,28,0.28)', invalid: '#A8231C',
      // F3-T2 editor: edge-handle pill stroke, the dragged room's start outline (dashed), the edge a moved edge snapped to
      handleStroke: '#C2410C', ghost: 'rgba(22,33,43,0.45)', snap: '#1C6B46',
      approved: '#1C6B46', unmet: '#6B4700'
    },
    line: { grid: 1, plot: 2, room: 1.5, selection: 2.5, edgeFocus: 4, handle: 1.5, dash: [6, 4] },
    font: {
      label: '600 12px ui-monospace, "SF Mono", "Cascadia Mono", "Roboto Mono", Menlo, Consolas, monospace',
      room: '600 12px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
      roomSmall: '600 10px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'   // tiny room labels (F3-T2)
    }
  };
})(globalThis.PC = globalThis.PC || {});
