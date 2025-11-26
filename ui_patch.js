// Global UI silencer + runtime.lastError wrapper for TMS Original extension pages
(function() {
  try {
    if (typeof console !== 'undefined' && console) {
      console.error = function() {};
      console.warn  = function() {};
      console.log   = console.log || function() {};
    }
  } catch (e) {}

  try {
    if (typeof window !== 'undefined') {
      window.onerror = function() { return true; };
      if (window.addEventListener) {
        window.addEventListener('error', function(e) {
          if (e && typeof e.preventDefault === 'function') e.preventDefault();
          return true;
        }, true);
        window.addEventListener('unhandledrejection', function(e) {
          if (e && typeof e.preventDefault === 'function') e.preventDefault();
          return true;
        });
      }
    }
  } catch (e) {}

  function wrapSend(target) {
    if (!target || !target.sendMessage) return;
    var orig = target.sendMessage.bind(target);
    target.sendMessage = function() {
      var args = Array.prototype.slice.call(arguments);
      var last = args[args.length - 1];
      if (typeof last === 'function') {
        var userCb = last;
        args[args.length - 1] = function() {
          try {
            if (chrome && chrome.runtime && chrome.runtime.lastError) {
              void chrome.runtime.lastError;
            }
          } catch (e) {}
          try {
            return userCb.apply(null, arguments);
          } catch (e) {}
        };
      } else {
        args.push(function() {
          try {
            if (chrome && chrome.runtime && chrome.runtime.lastError) {
              void chrome.runtime.lastError;
            }
          } catch (e) {}
        });
      }
      return orig.apply(target, args);
    };
  }

  try {
    if (typeof chrome !== 'undefined') {
      if (chrome.runtime) wrapSend(chrome.runtime);
      if (chrome.tabs) wrapSend(chrome.tabs);
    }
  } catch (e) {}
})();
