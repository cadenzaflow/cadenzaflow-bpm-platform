// CadenzaFlow: replaces the two moment.js calls of the original runtime.
import { parseEngineDate } from '../../../../shared/format';
import { toEngineDate } from '../../../../shared/variables';

// like moment(value, moment.ISO_8601): without offset the value is local time
function parseIsoDate(value) {
  if (value instanceof Date) {
    return value;
  }
  var text = String(value);
  return parseEngineDate(/^\d{4}-\d{2}-\d{2}$/.test(text) ? text + 'T00:00:00' : text);
}

/** "2026-10-13T11:49:55.000+0300", the format the engine REST API expects. */
export function formatEngineDate(value) {
  var date = parseIsoDate(value);
  return date ? toEngineDate(date) : value;
}

export function isSameInstant(a, b) {
  var first = parseIsoDate(a);
  var second = parseIsoDate(b);
  return !!first && !!second && first.getTime() === second.getTime();
}
