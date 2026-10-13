/**
 * Names of the elements of a BPMN XML (id → name), for labels such as the
 * activity of an incident; without loading bpmn-js. Elements without a name
 * are left out.
 */
export function elementNames(xml: string | undefined): Map<string, string> {
  const names = new Map<string, string>();
  if (!xml) {
    return names;
  }
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  for (const element of Array.from(document.querySelectorAll('[id][name]'))) {
    names.set(element.getAttribute('id')!, element.getAttribute('name')!);
  }
  return names;
}
