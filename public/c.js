/**
 * DropCollect Widget — c.js
 * Drop this script tag anywhere. A subscribe form appears immediately.
 * Usage: <script src="https://yourdomain.com/c.js?id=YOUR_ID"></script>
 */
(function () {
  'use strict';

  const script = document.currentScript;
  if (!script) return;

  const scriptSrc = script.src;
  let BASE_URL;
  try {
    const u = new URL(scriptSrc);
    BASE_URL = u.origin;
  } catch (e) {
    return;
  }

  const id = new URL(scriptSrc).searchParams.get('id');
  if (!id) { console.warn('[DropCollect] No collector id in script src.'); return; }

  // Inject styles (scoped to .dc- prefix)
  function injectStyles() {
    if (document.getElementById('dc-styles')) return;
    const s = document.createElement('style');
    s.id = 'dc-styles';
    s.textContent = `
      .dc-wrap{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.5;-webkit-font-smoothing:antialiased;}
      .dc-wrap *{box-sizing:border-box;}
      /* Minimal style */
      .dc-minimal{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
      .dc-minimal .dc-input{flex:1;min-width:180px;padding:10px 14px;border:1.5px solid rgba(0,0,0,0.15);border-radius:7px;font-size:14px;font-family:inherit;outline:none;background:#fff;transition:border-color 0.2s,box-shadow 0.2s;}
      .dc-minimal .dc-input:focus{border-color:var(--dc-color,#4dffcc);box-shadow:0 0 0 3px color-mix(in srgb,var(--dc-color,#4dffcc) 18%,transparent);}
      .dc-minimal .dc-btn{padding:10px 20px;background:var(--dc-color,#4dffcc);color:var(--dc-btn-text,#1a1a2e);border:none;border-radius:7px;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;white-space:nowrap;transition:opacity 0.2s,transform 0.1s;}
      .dc-minimal .dc-btn:hover{opacity:0.87;transform:translateY(-1px);}
      .dc-minimal .dc-btn:active{transform:translateY(0);}
      .dc-minimal .dc-btn:disabled{opacity:0.55;cursor:default;transform:none;}
      /* Card style */
      .dc-card{background:#fff;border:1px solid rgba(0,0,0,0.09);border-radius:14px;padding:28px;box-shadow:0 2px 24px rgba(0,0,0,0.08);}
      .dc-card .dc-headline{font-size:19px;font-weight:700;margin-bottom:5px;color:#111;}
      .dc-card .dc-sub{font-size:14px;color:#666;margin-bottom:18px;}
      .dc-card .dc-row{display:flex;gap:8px;flex-wrap:wrap;}
      .dc-card .dc-input{flex:1;min-width:180px;padding:10px 14px;border:1.5px solid rgba(0,0,0,0.15);border-radius:7px;font-size:14px;font-family:inherit;outline:none;background:#f8f8f8;transition:border-color 0.2s,box-shadow 0.2s;}
      .dc-card .dc-input:focus{border-color:var(--dc-color,#4dffcc);box-shadow:0 0 0 3px color-mix(in srgb,var(--dc-color,#4dffcc) 15%,transparent);background:#fff;}
      .dc-card .dc-btn{padding:10px 20px;background:var(--dc-color,#4dffcc);color:var(--dc-btn-text,#1a1a2e);border:none;border-radius:7px;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;white-space:nowrap;transition:opacity 0.2s,transform 0.1s;}
      .dc-card .dc-btn:hover{opacity:0.87;transform:translateY(-1px);}
      .dc-card .dc-btn:active{transform:translateY(0);}
      .dc-card .dc-btn:disabled{opacity:0.55;cursor:default;transform:none;}
      /* Messages */
      .dc-msg{font-size:13px;margin-top:8px;padding:0 2px;}
      .dc-msg.ok{color:#16a34a;}
      .dc-msg.err{color:#dc2626;}
      /* Success state */
      .dc-success{padding:14px 20px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;color:#15803d;font-size:14px;font-weight:600;}
      .dc-card .dc-success{background:#f0fdf4;border-color:#bbf7d0;color:#15803d;border-radius:8px;padding:12px 16px;margin-top:12px;}
      /* Capacity */
      .dc-cap{padding:14px 20px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;color:#c2410c;font-size:14px;}
      .dc-card .dc-cap{background:#fff7ed;border-color:#fed7aa;color:#c2410c;border-radius:8px;padding:12px 16px;}
      /* Spinner */
      .dc-spin{display:inline-block;width:14px;height:14px;border:2px solid rgba(0,0,0,0.15);border-top-color:rgba(0,0,0,0.5);border-radius:50%;animation:dc-rot 0.6s linear infinite;vertical-align:middle;margin-right:4px;}
      @keyframes dc-rot{to{transform:rotate(360deg)}}
    `;
    document.head.appendChild(s);
  }

  // Determine if button text color should be dark or light based on bg
  function btnTextColor(hex) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substr(0,2),16), g = parseInt(h.substr(2,2),16), b = parseInt(h.substr(4,2),16);
    const lum = 0.299*r + 0.587*g + 0.114*b;
    return lum > 145 ? '#1a1a2e' : '#ffffff';
  }

  function buildWidget(config) {
    const container = document.createElement('div');
    container.className = 'dc-wrap';
    container.setAttribute('data-dc-id', id);

    const btnColor = config.button_color || '#4dffcc';
    const btnText = config.button_label || 'Subscribe';
    container.style.setProperty('--dc-color', btnColor);
    container.style.setProperty('--dc-btn-text', btnTextColor(btnColor));

    if (config.widget_style === 'card') {
      container.innerHTML = `
        <div class="dc-card">
          ${config.headline ? `<div class="dc-headline">${esc(config.headline)}</div>` : ''}
          ${config.subheadline ? `<div class="dc-sub">${esc(config.subheadline)}</div>` : ''}
          <div class="dc-row">
            <input class="dc-input" type="email" placeholder="your@email.com" aria-label="Email address">
            <button class="dc-btn">${esc(btnText)}</button>
          </div>
          <div class="dc-msg" role="status"></div>
        </div>`;
    } else {
      container.innerHTML = `
        <div class="dc-minimal">
          <input class="dc-input" type="email" placeholder="your@email.com" aria-label="Email address">
          <button class="dc-btn">${esc(btnText)}</button>
        </div>
        <div class="dc-msg" role="status"></div>`;
    }

    const input = container.querySelector('.dc-input');
    const btn = container.querySelector('.dc-btn');
    const msg = container.querySelector('.dc-msg');
    const inner = container.querySelector('.dc-card') || container.querySelector('.dc-minimal');

    function setMsg(text, type) {
      msg.textContent = text;
      msg.className = 'dc-msg ' + type;
    }

    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') btn.click();
    });

    btn.addEventListener('click', async function () {
      const email = input.value.trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setMsg('Please enter a valid email address.', 'err');
        input.focus();
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<span class="dc-spin"></span>';
      msg.className = 'dc-msg';

      try {
        const res = await fetch(BASE_URL + '/api/collect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, email }),
        });
        const data = await res.json();

        if (res.ok) {
          // Show success
          input.value = '';
          const successEl = document.createElement('div');
          successEl.className = 'dc-success';
          successEl.textContent = '✓ You\'re on the list!';
          if (config.widget_style === 'card') {
            inner.appendChild(successEl);
            inner.querySelector('.dc-row').style.display = 'none';
          } else {
            inner.style.display = 'none';
            container.insertBefore(successEl, msg);
          }
          msg.className = 'dc-msg';
        } else if (data.error === 'capacity_reached') {
          const capEl = document.createElement('div');
          capEl.className = 'dc-cap';
          capEl.textContent = '📬 We\'re at capacity — registrations are closed for now.';
          if (config.widget_style === 'card') {
            inner.innerHTML = '';
            inner.appendChild(capEl);
          } else {
            inner.style.display = 'none';
            container.insertBefore(capEl, msg);
          }
        } else if (data.error === 'already_subscribed') {
          setMsg('You\'re already on the list!', 'ok');
          btn.disabled = false;
          btn.textContent = btnText;
        } else {
          setMsg('Something went wrong. Please try again.', 'err');
          btn.disabled = false;
          btn.textContent = btnText;
        }
      } catch (err) {
        setMsg('Network error. Please try again.', 'err');
        btn.disabled = false;
        btn.textContent = btnText;
      }
    });

    return container;
  }

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  async function init() {
    injectStyles();

    // Find insertion point (where this script tag is)
    const placeholder = document.createElement('div');
    placeholder.setAttribute('data-dc-loading', id);
    script.parentNode.insertBefore(placeholder, script);

    try {
      const res = await fetch(`${BASE_URL}/api/config?id=${id}`);
      if (!res.ok) throw new Error('Collector not found');
      const config = await res.json();
      const widget = buildWidget(config);
      placeholder.replaceWith(widget);
    } catch (e) {
      placeholder.remove();
      console.warn('[DropCollect] Could not load widget:', e.message);
    }
  }

  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
