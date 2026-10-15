/** Plain styles for the preview; the page's styles do not reach into the sandbox. */
const PREVIEW_STYLE =
  'body{margin:0.5rem;font-family:system-ui,sans-serif;font-size:14px;line-height:1.4;color:#161616}' +
  'fieldset{border:0;margin:0;padding:0;min-width:0}' +
  'input,select,textarea,button{font:inherit}';

/** The preview loads nothing: no images, styles or fonts from the server or elsewhere. */
const PREVIEW_POLICY = "default-src 'none'; style-src 'unsafe-inline'; img-src data:";

/** The document the sandbox shows: the HTML as a disabled form, as the classic Cockpit shows it. */
export function previewDocument(html: string): string {
  return (
    `<!doctype html><html><head><meta charset="utf-8">` +
    `<meta http-equiv="Content-Security-Policy" content="${PREVIEW_POLICY}">` +
    `<style>${PREVIEW_STYLE}</style></head><body><fieldset disabled>${html}</fieldset></body></html>`
  );
}

/**
 * An HTML resource of a deployment (typically an embedded task form),
 * rendered in a sandboxed frame: its scripts do not run, it has no access to
 * this page or the server session, it loads nothing, and its forms cannot be
 * submitted.
 */
export function HtmlPreview({ html, title }: { html: string; title: string }) {
  return <iframe className="cz-repository__html-preview" sandbox="" srcDoc={previewDocument(html)} title={title} />;
}
