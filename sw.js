/* 
 * Service Worker Wrapper for TMS [MV3 Fix]
 * Adapts the old Vue/Webpack environment to Chrome Manifest V3
 */

// --- 1. ENVIRONMENT POLYFILLS (Эмуляция DOM для старого кода) ---
(function() {
  self.window = self;
  try { if (typeof console !== 'undefined' && console) {} } catch (e) {}

  self.document = {
    head: {
      appendChild: function(el) {
        if (!el || !el.src) return;
        try {
          importScripts(el.src);
          if (typeof el.onload === 'function') el.onload();
        } catch (e) {
          if (typeof el.onerror === 'function') el.onerror(e);
        }
      }
    },
    createElement: function(tag) {
      return {
        tagName: String(tag || '').toUpperCase(),
        attrs: {},
        src: '',
        setAttribute: function(name, value) {
          this.attrs[name] = value;
          if (name === 'src') this.src = value;
        }
      };
    },
    getElementsByTagName: function(tag) {
      return (String(tag || '').toLowerCase() === 'head') ? [this.head] : [];
    }
  };
})();

// --- 2. API PATCHES (Исправление ошибок Chrome API для MV3) ---
(function() {
  // Подавляем ошибки lastError в sendMessage
  function wrapSend(target) {
    if (!target || !target.sendMessage) return;
    var orig = target.sendMessage.bind(target);
    target.sendMessage = function() {
      var args = Array.prototype.slice.call(arguments);
      var last = args[args.length - 1];
      if (typeof last === 'function') {
        args[args.length - 1] = function() {
          try { void chrome.runtime.lastError; } catch (e) {}
          return last.apply(null, arguments);
        };
      } else {
        args.push(function() { try { void chrome.runtime.lastError; } catch (e) {} });
      }
      return orig.apply(target, args);
    };
  }

  try {
    if (typeof chrome !== 'undefined') {
      if (chrome.runtime) wrapSend(chrome.runtime);
      if (chrome.tabs) {
        wrapSend(chrome.tabs);
        
        // !!! ВАЖНО: Полифилл для chrome.tabs.executeScript (V2 -> V3) !!!
        // Старый код bg.js использует это для инъекции tabFetch.js
        if (!chrome.tabs.executeScript && chrome.scripting) {
            chrome.tabs.executeScript = function(tabId, details, callback) {
                // Обработка инъекции файла
                if (details && details.file) {
                    chrome.scripting.executeScript({
                        target: { tabId: tabId },
                        files: [details.file]
                    }, (results) => {
                        if (callback) callback(results);
                    });
                } 
                // Обработка инъекции кода (сложнее в MV3, но заглушка нужна чтобы не упало)
                else if (details && details.code) {
                    // Пытаемся выполнить, если это простой код, иначе логируем
                    console.warn("TMS MV3 Warning: Dynamic code injection via string is restricted.");
                    if (callback) callback([]); 
                }
            };
        }
      }
      
      // Заглушка для removeAll (чтобы bg.js не удалял наше меню)
      if (chrome.contextMenus) {
          chrome.contextMenus.removeAll = function(cb) {
              if (typeof cb === "function") cb();
          };
      }
    }
  } catch (e) {}
})();

// --- 3. LOAD LEGACY CODE (Запуск приложения) ---
try {
  importScripts('bg.js');
} catch (e) {
  console.error("TMS Error: Failed to load bg.js.", e);
}

// --- 4. NEW CONTEXT MENU LOGIC (Восстановленное меню) ---
const TMS_MENU_ID = "tms_fix_search_v3";

function createTMSMenu() {
    chrome.contextMenus.create({
        id: TMS_MENU_ID,
        title: "🔍 TMS - Поиск: \"%s\"",
        contexts: ["selection"]
    }, () => {
        if (chrome.runtime.lastError) return;
    });
}

chrome.runtime.onInstalled.addListener(createTMSMenu);
chrome.runtime.onStartup.addListener(createTMSMenu);

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === TMS_MENU_ID && info.selectionText) {
        const query = info.selectionText.trim();
        const searchUrl = chrome.runtime.getURL("index.html") + "#/search?query=" + encodeURIComponent(query);
        chrome.tabs.create({ url: searchUrl, active: true });
    }
});