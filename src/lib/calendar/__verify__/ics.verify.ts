import { buildICSCalendar, escapeICSText, foldLine, formatDateValue, formatDateValuePlusDays } from '../ics';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error('FAIL: ' + msg);
  console.log('ok - ' + msg);
}

// Build input/expected via char codes to avoid any string-literal escaping ambiguity.
const BACKSLASH = String.fromCharCode(92);
const COMMA = ',';
const SEMI = ';';
const NL = String.fromCharCode(10);

const input = ['a', COMMA, 'b', SEMI, 'c', BACKSLASH, 'd', NL, 'e'].join('');
const expected = ['a', BACKSLASH + COMMA, 'b', BACKSLASH + SEMI, 'c', BACKSLASH + BACKSLASH, 'd', BACKSLASH + 'n', 'e'].join('');
const actual = escapeICSText(input);
assert(actual === expected, 'escape order + all four chars: got ' + JSON.stringify(actual) + ' expected ' + JSON.stringify(expected));

assert(formatDateValue('2026-07-20') === '20260720', 'date-only format');
assert(formatDateValue('2026-07-20T10:00:00Z') === '20260720', 'datetime format strips time');
assert(formatDateValuePlusDays('2026-12-31', 1) === '20270101', 'date+1 crosses year boundary');

const long = 'SUMMARY:' + 'x'.repeat(100);
const folded = foldLine(long);
assert(folded.includes('\r\n '), 'long line folds with CRLF+space');
for (const part of folded.split('\r\n')) {
  assert(Buffer.byteLength(part, 'utf8') <= 75, 'each folded chunk <=75 octets: ' + part.length);
}

const ics = buildICSCalendar([
  { task: { id: 't1', status: 'not_started', title: 'Ship it', dueDate: '2026-07-20', startDate: '2026-07-18', priority: 'high' } as any, projectName: 'Launch' },
  { task: { id: 't2', status: 'completed', title: 'Done thing', dueDate: '2026-07-01' } as any, projectName: 'Launch' },
  { task: { id: 't3', status: 'in_progress', title: 'No due date' } as any, projectName: 'Launch' },
]);
assert(ics.includes('BEGIN:VCALENDAR'), 'has VCALENDAR');
assert(ics.includes('PRODID:-//CXD Canvas'), 'has PRODID with CXD Canvas');
assert(ics.includes('UID:t1@cxd'), 'includes t1 event');
assert(!ics.includes('UID:t2@cxd'), 'excludes completed t2');
assert(!ics.includes('UID:t3@cxd'), 'excludes no-due-date t3');
assert(ics.includes('DTSTART;VALUE=DATE:20260718'), 'DTSTART uses startDate');
assert(ics.includes('DTEND;VALUE=DATE:20260721'), 'DTEND uses dueDate+1');
assert(ics.includes('SUMMARY:[Launch] Ship it'), 'summary has project prefix');
assert(ics.includes('\r\n'), 'uses CRLF');

console.log('ALL PASS');
