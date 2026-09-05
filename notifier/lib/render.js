function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const SHELL_STYLE = `
  body{ background:#12151b; color:#e8ebf0; font-family:Arial,Helvetica,sans-serif; margin:0; padding:40px 16px; }
  .card{ max-width:480px; margin:0 auto; background:#1a1f28; border:1px solid #2a313d; border-radius:10px; padding:28px 26px; }
  h1{ font-size:19px; margin:0 0 12px; }
  p{ color:#97a1b3; font-size:14px; line-height:1.5; }
  label{ display:block; font-size:12px; text-transform:uppercase; letter-spacing:.04em; color:#626c7d; margin:16px 0 6px; }
  textarea, input[type="date"]{ width:100%; box-sizing:border-box; background:#1f2531; border:1px solid #2a313d; color:#e8ebf0; border-radius:6px; padding:10px; font-size:14px; font-family:inherit; }
  textarea{ min-height:100px; resize:vertical; }
  button{ margin-top:18px; background:#f0a63b; border:none; color:#1a1200; font-weight:bold; padding:10px 20px; border-radius:6px; font-size:14px; cursor:pointer; }
  .error{ color:#d96a6a; font-size:13px; margin-top:8px; }
`;

// A plain confirmation/status page — used for Accept, and for the "already
// responded" / "expired" / "missing token" states on every action.
function htmlPage(title, message) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><style>${SHELL_STYLE}</style></head>
<body><div class="card"><h1>${esc(title)}</h1><p>${message}</p></div></body></html>`;
}

// A small form (Decline's reason, Reschedule's date + reason) that POSTs back to the
// same URL it was served from, carrying the token along as a hidden field.
function htmlForm({ title, intro, token, fields, submitLabel, error }) {
  const fieldsHtml = fields
    .map((f) => {
      if (f.type === 'textarea') {
        return `<label for="${f.name}">${esc(f.label)}</label><textarea id="${f.name}" name="${f.name}" ${f.required ? 'required' : ''}></textarea>`;
      }
      if (f.type === 'date') {
        return `<label for="${f.name}">${esc(f.label)}</label><input type="date" id="${f.name}" name="${f.name}" ${f.required ? 'required' : ''} min="${esc(f.min || '')}">`;
      }
      return '';
    })
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><style>${SHELL_STYLE}</style></head>
<body><div class="card">
  <h1>${esc(title)}</h1>
  <p>${esc(intro)}</p>
  <form method="POST">
    <input type="hidden" name="token" value="${esc(token)}">
    ${fieldsHtml}
    ${error ? `<div class="error">${esc(error)}</div>` : ''}
    <button type="submit">${esc(submitLabel)}</button>
  </form>
</div></body></html>`;
}

module.exports = { esc, htmlPage, htmlForm };
