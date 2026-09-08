/**
 * ReviewWhisper AI — storefront widget.
 *
 * Injected on Shopify storefronts via a script tag. The API origin is derived
 * from the script's own src, so the same file works on any deployment without
 * a hardcoded domain. Override explicitly with data-api-origin if needed.
 */
(function () {
  'use strict';

  var scriptTag =
    document.currentScript ||
    (function () {
      var all = document.getElementsByTagName('script');
      for (var i = all.length - 1; i >= 0; i--) {
        if (all[i].src && all[i].src.indexOf('widget.js') !== -1) return all[i];
      }
      return null;
    })();

  function attr(name) {
    return scriptTag ? scriptTag.getAttribute(name) : null;
  }

  var apiOrigin = attr('data-api-origin');
  if (!apiOrigin && scriptTag && scriptTag.src) {
    try {
      apiOrigin = new URL(scriptTag.src, location.href).origin;
    } catch {
      apiOrigin = '';
    }
  }
  if (!apiOrigin) apiOrigin = location.origin;

  var storeDomain =
    attr('data-store-domain') ||
    (window.Shopify && window.Shopify.shop) ||
    location.hostname;

  var productId =
    attr('data-product-id') ||
    (window.meta && window.meta.product && window.meta.product.id) ||
    (window.ShopifyAnalytics &&
      window.ShopifyAnalytics.meta &&
      window.ShopifyAnalytics.meta.product &&
      window.ShopifyAnalytics.meta.product.id) ||
    null;

  if (!productId) return;
  if (document.getElementById('rw-widget-container')) return;

  function mount() {
    var widgetContainer = document.createElement('div');
    widgetContainer.id = 'rw-widget-container';
    widgetContainer.innerHTML = [
      '<div style="position: fixed; bottom: 20px; right: 20px; z-index: 999999; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif;">',
      '  <button id="rw-toggle-btn" aria-label="Ask past buyers" style="background: #18181b; color: #ffffff; border: none; padding: 14px 22px; border-radius: 50px; cursor: pointer; font-weight: 600; font-size: 14px; box-shadow: 0 4px 14px rgba(0,0,0,0.16); transition: transform 0.2s ease;">&#128172; Ask Past Buyers</button>',
      '  <div id="rw-chat-box" style="display: none; width: 340px; height: 440px; max-width: calc(100vw - 40px); background: #ffffff; border: 1px solid #e4e4e7; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.12); position: absolute; bottom: 70px; right: 0; flex-direction: column; overflow: hidden;">',
      '    <div style="background: #18181b; color: #ffffff; padding: 16px; font-weight: 600; font-size: 15px;">ReviewWhisper AI Assistant</div>',
      '    <div id="rw-chat-logs" style="flex: 1; padding: 16px; overflow-y: auto; font-size: 14px; color: #27272a; background: #fafafa;">',
      '      <div style="margin-bottom: 12px; text-align: left;"><div style="background: #f4f4f5; padding: 10px; border-radius: 8px; display: inline-block; max-width: 85%;">Hi there! I can scan all past buyer reviews to answer questions about this item instantly. Try asking about fit, material or quality.</div></div>',
      '    </div>',
      '    <div style="padding: 12px; border-top: 1px solid #e4e4e7; display: flex; background: #ffffff;">',
      '      <input type="text" id="rw-input" placeholder="Is it true to size?" style="flex: 1; min-width: 0; padding: 10px 14px; border: 1px solid #e4e4e7; border-radius: 8px; outline: none; font-size: 14px;">',
      '      <button id="rw-send" style="margin-left: 8px; background: #18181b; color: #ffffff; border: none; padding: 10px 16px; border-radius: 8px; cursor: pointer; font-weight: 500; font-size: 14px;">Send</button>',
      '    </div>',
      '  </div>',
      '</div>',
    ].join('');
    document.body.appendChild(widgetContainer);

    var toggleBtn = document.getElementById('rw-toggle-btn');
    var chatBox = document.getElementById('rw-chat-box');
    var sendBtn = document.getElementById('rw-send');
    var inputEl = document.getElementById('rw-input');
    var logsEl = document.getElementById('rw-chat-logs');
    var busy = false;

    function escapeHtml(str) {
      return String(str).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    function append(html) {
      logsEl.insertAdjacentHTML('beforeend', html);
      logsEl.scrollTop = logsEl.scrollHeight;
    }

    toggleBtn.onclick = function () {
      var isHidden = chatBox.style.display === 'none' || !chatBox.style.display;
      chatBox.style.display = isHidden ? 'flex' : 'none';
      if (isHidden) inputEl.focus();
    };

    function handleSubmission() {
      var question = inputEl.value.trim();
      if (!question || busy) return;
      busy = true;
      sendBtn.disabled = true;

      append(
        '<div style="margin-bottom: 12px; text-align: right;"><div style="background: #18181b; color: #ffffff; padding: 10px; border-radius: 8px; display: inline-block; max-width: 85%; text-align: left;">' +
          escapeHtml(question) +
          '</div></div>',
      );
      inputEl.value = '';

      var typingId = 'rw-typing-' + Date.now();
      append(
        '<div id="' +
          typingId +
          '" style="margin-bottom: 12px; text-align: left;"><div style="background: #e4e4e7; color: #71717a; padding: 10px; border-radius: 8px; display: inline-block;">AI is thinking...</div></div>',
      );

      fetch(apiOrigin + '/api/widget/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: productId, storeDomain: storeDomain, question: question }),
      })
        .then(function (res) {
          return res.json();
        })
        .then(function (data) {
          var indicator = document.getElementById(typingId);
          if (indicator) indicator.remove();
          append(
            '<div style="margin-bottom: 12px; text-align: left;"><div style="background: #f4f4f5; padding: 10px; border-radius: 8px; display: inline-block; max-width: 85%;">' +
              escapeHtml(data.response || data.error || 'No answer available.') +
              '</div></div>',
          );
        })
        .catch(function () {
          var indicator = document.getElementById(typingId);
          if (indicator) indicator.remove();
          append(
            '<div style="margin-bottom: 12px; text-align: left;"><div style="background: #fee2e2; color: #991b1b; padding: 10px; border-radius: 8px; display: inline-block; max-width: 85%;">Error getting answer. Please try again.</div></div>',
          );
        })
        .then(function () {
          busy = false;
          sendBtn.disabled = false;
          inputEl.focus();
        });
    }

    sendBtn.onclick = handleSubmission;
    inputEl.onkeydown = function (e) {
      if (e.key === 'Enter') handleSubmission();
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
