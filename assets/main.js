/*
 * Shared interactions for all pages. Each feature checks for the elements it
 * needs, so the same file is safe to include everywhere.
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
   * Theme (light / dark), persisted in localStorage
   * ------------------------------------------------------------------ */
  var root = document.documentElement;

  function setTheme(theme) {
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    root.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }

  var stored = localStorage.getItem('theme');
  setTheme(stored === 'dark' ? 'dark' : 'light');

  document.querySelectorAll('.theme-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      setTheme(root.classList.contains('dark') ? 'light' : 'dark');
    });
  });

  /* ------------------------------------------------------------------
   * Mobile menu
   * ------------------------------------------------------------------ */
  var menuBtn = document.getElementById('mobile-menu-toggle');
  var menu = document.getElementById('mobile-menu');
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', function () {
      var open = menu.classList.toggle('hidden');
      menuBtn.setAttribute('aria-expanded', String(!open));
    });
  }

  /* ------------------------------------------------------------------
   * Live clock on the home page sidebar
   * ------------------------------------------------------------------ */
  var clock = document.getElementById('current-time');
  if (clock) {
    var tz = 'Asia/Shanghai';
    var updateClock = function () {
      var time = new Date().toLocaleString('en-US', { hour12: false, timeZone: tz });
      clock.textContent = 'Current time: ' + time + ' (' + tz + ')';
    };
    updateClock();
    setInterval(updateClock, 1000);
  }

  /* ------------------------------------------------------------------
   * MathJax: typeset after the page (and the CDN script) has loaded
   * ------------------------------------------------------------------ */
  window.addEventListener('load', function () {
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise();
    }
  });

  /* ------------------------------------------------------------------
   * BibTeX buttons (publications page): hover shows a preview panel,
   * click copies the entry to the clipboard.
   * ------------------------------------------------------------------ */
  var bibButtons = document.querySelectorAll('[data-bibtex-button]');
  if (!bibButtons.length) return;

  function firstAuthorYear(bib) {
    var authorMatch = bib.match(/author\s*=\s*\{([^}]+)\}/i);
    var yearMatch = bib.match(/year\s*=\s*\{([^}]+)\}/i);
    var author = authorMatch ? authorMatch[1] : '';
    var year = yearMatch ? yearMatch[1] : '';
    var first = author.split(/\s+and\s+/i)[0].trim();
    var surname = first.includes(',')
      ? first.split(',')[0].trim()
      : first.split(/\s+/).slice(-1)[0];
    return [surname, year].filter(Boolean).join(' ');
  }

  function formatBibtex(bib) {
    var lines = (bib || '')
      .replace(/\r/g, '')
      .split('\n')
      .map(function (l) { return l.trim(); })
      .filter(function (l) { return l.length; });
    var merged = [];
    lines.forEach(function (line) {
      if (line.startsWith('@') || line === '}' || line.includes('=')) {
        merged.push(line);
      } else if (merged.length) {
        merged[merged.length - 1] += ' ' + line;
      } else {
        merged.push(line);
      }
    });
    return merged
      .map(function (line, idx) {
        return idx === 0 || line === '}' ? line : '  ' + line;
      })
      .join('\n');
  }

  function previewText(bib) {
    var header = firstAuthorYear(bib || '');
    return (header ? header + '\n\n' : '') + formatBibtex(bib || '');
  }

  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  function copyBibtex(bib) {
    if (!bib) return Promise.resolve(false);
    if (window.isSecureContext && navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(bib)
        .then(function () { return true; })
        .catch(function () { return legacyCopy(bib); });
    }
    return Promise.resolve(legacyCopy(bib));
  }

  function flashButtonLabel(btn, text) {
    var textNode = null;
    for (var i = btn.childNodes.length - 1; i >= 0; i--) {
      if (btn.childNodes[i].nodeType === Node.TEXT_NODE) {
        textNode = btn.childNodes[i];
        break;
      }
    }
    if (!textNode) return;
    var original = btn.getAttribute('data-bibtex-label');
    if (!original) {
      original = (textNode.nodeValue || 'BibTeX').trim() || 'BibTeX';
      btn.setAttribute('data-bibtex-label', original);
    }
    textNode.nodeValue = text;
    setTimeout(function () { textNode.nodeValue = original; }, 1200);
  }

  // Single fixed-position preview panel shared by all buttons
  var panel = document.createElement('div');
  panel.className = 'bibtex-global';
  panel.innerHTML = '<div class="bibtex-panel"><pre class="bibtex-preview"></pre></div>';
  document.body.appendChild(panel);
  var preview = panel.querySelector('.bibtex-preview');

  function positionAt(btn) {
    panel.style.left = '0px';
    panel.style.top = '0px';
    var rect = btn.getBoundingClientRect();
    var popRect = panel.getBoundingClientRect();
    var left = Math.min(
      Math.max(12, rect.right - popRect.width),
      window.innerWidth - popRect.width - 12
    );
    var top = Math.min(rect.bottom + 8, window.innerHeight - popRect.height - 12);
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
  }

  function show(btn, bib) {
    preview.textContent = previewText(bib || '');
    panel.classList.add('show');
    positionAt(btn);
  }

  function hide() {
    panel.classList.remove('show');
  }

  bibButtons.forEach(function (btn) {
    var card = btn.closest('[data-bibtex]');
    if (!card) return;
    var bib = card.getAttribute('data-bibtex') || '';
    btn.addEventListener('mouseenter', function () { show(btn, bib); });
    btn.addEventListener('mouseleave', hide);
    btn.addEventListener('focus', function () { show(btn, bib); });
    btn.addEventListener('blur', hide);
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      copyBibtex(bib).then(function (ok) {
        flashButtonLabel(btn, ok ? 'Copied' : 'Copy failed');
      });
    });
  });

  panel.addEventListener('mouseenter', function () { panel.classList.add('show'); });
  panel.addEventListener('mouseleave', hide);
  window.addEventListener('scroll', hide, { passive: true });
})();
