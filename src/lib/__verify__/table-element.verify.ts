/**
 * Verification for the table CanvasElement round-trip through the Y.Doc.
 * Run: npx tsx src/lib/__verify__/table-element.verify.ts
 *
 * Asserts: a TableElement with per-cell text + formatting, rowColors, colColors,
 * colWidths, rowHeights, tableBg, borderColor and headerRow survives
 * canvasElementToYMap → yMapToCanvasElement intact (2D cells grid, colors,
 * bold/italic/align, per-track sizes).
 */
import * as Y from 'yjs';
import { canvasElementToYMap, yMapToCanvasElement } from '../yjs/element-serializers';
import { makeEmptyTableCells } from '@/types/canvas-elements';
import type { TableElement } from '@/types/canvas-elements';

let failures = 0;
function check(cond: boolean, msg: string) {
  if (!cond) { failures++; console.error(`  ✗ ${msg}`); }
  else console.log(`  ✓ ${msg}`);
}

const cells = makeEmptyTableCells(2, 3);
cells[0][0] = { text: 'Name', bold: true, align: 'center', color: '#22D3EE', fontSize: 'lg' };
cells[0][1] = { text: 'Value', italic: true };
cells[1][0] = { text: 'row cell', bg: 'linear-gradient(135deg, #2A0A3D 0%, #4B1B6B 50%, #0B2C5A 100%)', fontSize: 'sm' };
cells[1][2] = { text: 'last', align: 'right' };

const table: TableElement = {
  id: 'tbl-1',
  type: 'table',
  x: 100, y: 200, width: 360, height: 150, zIndex: 5,
  rows: 2, cols: 3,
  cells,
  rowColors: ['#123A5A', null],
  colColors: [null, null, '#3B1842'],
  rowGradient: [null, '#4B1B6B'],     // continuous horizontal gradient base for row 1
  colGradient: [null, '#0F3A3A', null], // continuous vertical gradient base for col 1
  colWidths: [120, 90, 150],
  rowHeights: [60, 90],
  tableBg: 'rgba(20,16,31,0.72)',
  borderColor: 'rgba(139,92,246,0.35)',
  lineColor: '#8B5CF6',
  lineWidth: 2,
  headerRow: true,
};

// Integrate into a real Y.Doc (as the elements map does at runtime) before reading back.
const doc = new Y.Doc();
const elements = doc.getMap<Y.Map<unknown>>('elements');
doc.transact(() => { elements.set(table.id, canvasElementToYMap(table)); });
const round = yMapToCanvasElement(elements.get(table.id) as Y.Map<unknown>) as TableElement;

check(round.type === 'table', 'type is table');
check(round.rows === 2 && round.cols === 3, 'rows/cols preserved');
check(Array.isArray(round.cells) && Array.isArray(round.cells[0]), 'cells is a 2D array');
check(round.cells.length === 2 && round.cells[0].length === 3, 'grid dimensions preserved');
check(round.cells[0][0].text === 'Name', 'cell text preserved');
check(round.cells[0][0].bold === true, 'cell bold preserved');
check(round.cells[0][0].align === 'center', 'cell align preserved');
check(round.cells[0][0].color === '#22D3EE', 'cell text color preserved');
check(round.cells[0][1].italic === true, 'cell italic preserved');
check(round.cells[0][0].fontSize === 'lg', 'cell fontSize (lg) preserved');
check(round.cells[1][0].fontSize === 'sm', 'cell fontSize (sm) preserved');
check(round.cells[1][0].bg === table.cells[1][0].bg, 'cell bg (gradient) preserved');
check(round.cells[1][2].align === 'right', 'far cell align preserved');
check(round.rowColors?.[0] === '#123A5A' && round.rowColors?.[1] === null, 'rowColors preserved (incl null)');
check(round.colColors?.[2] === '#3B1842', 'colColors preserved');
check(Array.isArray(round.rowGradient) && round.rowGradient?.[0] === null && round.rowGradient?.[1] === '#4B1B6B', 'rowGradient preserved (incl null)');
check(Array.isArray(round.colGradient) && round.colGradient?.[1] === '#0F3A3A', 'colGradient preserved');
check(Array.isArray(round.colWidths) && round.colWidths?.length === 3, 'colWidths is a length-3 array');
check(round.colWidths?.[0] === 120 && round.colWidths?.[1] === 90 && round.colWidths?.[2] === 150, 'colWidths values preserved');
check(Array.isArray(round.rowHeights) && round.rowHeights?.length === 2, 'rowHeights is a length-2 array');
check(round.rowHeights?.[0] === 60 && round.rowHeights?.[1] === 90, 'rowHeights values preserved');
check(round.tableBg === 'rgba(20,16,31,0.72)', 'tableBg preserved');
check(round.borderColor === 'rgba(139,92,246,0.35)', 'borderColor preserved');
check(round.lineColor === '#8B5CF6', 'lineColor preserved');
check(round.lineWidth === 2, 'lineWidth preserved');
check(round.headerRow === true, 'headerRow preserved');

if (failures > 0) {
  console.error(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll table round-trip checks passed.');
