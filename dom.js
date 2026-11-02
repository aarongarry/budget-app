// Reuse existing elements so syncing does not reset focus, scroll, or progress bars.
const key = node => node.nodeType === 1 ? node.getAttribute('data-key') || node.id : null;
const compatible = (a, b) => a && a.nodeType === b.nodeType && a.nodeName === b.nodeName && key(a) === key(b);

function patchNode(current, next) {
  if (current.nodeType !== 1) {
    if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue;
    return;
  }
  for (const attr of [...current.attributes]) {
    if (!next.hasAttribute(attr.name)) current.removeAttribute(attr.name);
  }
  for (const attr of next.attributes) {
    if (current.getAttribute(attr.name) !== attr.value) current.setAttribute(attr.name, attr.value);
  }
  patchChildren(current, next);
}

function patchChildren(parent, source) {
  let cursor = parent.firstChild;
  for (const next of [...source.childNodes]) {
    let current = cursor;
    if (key(next)) current = [...parent.childNodes].find(node => compatible(node, next));
    if (!compatible(current, next)) {
      current = next.cloneNode(true);
      parent.insertBefore(current, cursor);
    } else {
      if (current !== cursor) parent.insertBefore(current, cursor);
      patchNode(current, next);
    }
    cursor = current.nextSibling;
  }
  while (cursor) {
    const next = cursor.nextSibling;
    cursor.remove();
    cursor = next;
  }
}

export function renderHTML(target, html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  patchChildren(target, template.content);
}
