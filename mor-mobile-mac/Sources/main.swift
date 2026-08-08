import Cocoa
import WebKit

private let messengerURL = URL(string: "https://www.ri-d.com/messenger")!
private let mobileContentWidth: CGFloat = 430
private let contentTopInset: CGFloat = 22

final class MobileShellView: NSView {
  let webView: WKWebView

  override init(frame frameRect: NSRect) {
    let configuration = WKWebViewConfiguration()
    configuration.websiteDataStore = .default()
    configuration.allowsAirPlayForMediaPlayback = true
    configuration.preferences.javaScriptCanOpenWindowsAutomatically = true

    let viewportScript = WKUserScript(
      source: """
      (function () {
        function installShellStyle() {
          if (!document.head || !document.body) {
            window.setTimeout(installShellStyle, 50);
            return;
          }

          var viewport = document.querySelector('meta[name="viewport"]');
          if (!viewport) {
            viewport = document.createElement('meta');
            viewport.setAttribute('name', 'viewport');
            document.head.appendChild(viewport);
          }
          viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover');
          document.documentElement.classList.add('mor-mac-mobile-shell');

          var style = document.querySelector('style[data-rid-mobile-shell="true"]');
          if (!style) {
            style = document.createElement('style');
            style.setAttribute('data-rid-mobile-shell', 'true');
            document.head.appendChild(style);
          }
          var shellCss = [
            '.mor-mac-mobile-shell body { overflow-x: hidden !important; }',
            '.mor-mac-mobile-shell .rid-mac-hidden-brand { display: none !important; visibility: hidden !important; height: 0 !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; }',
            '.mor-mac-mobile-shell .rid-mac-mobile-title-offset { margin-top: 20px !important; margin-left: 10px !important; transform: translateX(8px) !important; }',
            '.mor-mac-mobile-shell.rid-mac-admin-mobile, .mor-mac-mobile-shell.rid-mac-admin-mobile body { overflow-x: hidden !important; }',
            '.mor-mac-mobile-shell.rid-mac-admin-mobile * { box-sizing: border-box !important; }',
            '.mor-mac-mobile-shell.rid-mac-admin-mobile .rid-admin-mobile-grid { display: grid !important; grid-template-columns: minmax(0, 1fr) !important; width: 100% !important; max-width: 100% !important; gap: 16px !important; overflow: visible !important; }',
            '.mor-mac-mobile-shell.rid-mac-admin-mobile .rid-admin-mobile-card { width: 100% !important; max-width: calc(100vw - 36px) !important; min-width: 0 !important; margin-left: auto !important; margin-right: auto !important; overflow: hidden !important; }',
            '.mor-mac-mobile-shell.rid-mac-admin-mobile .rid-admin-mobile-field { width: 100% !important; max-width: 100% !important; min-width: 0 !important; overflow: hidden !important; text-overflow: ellipsis !important; }'
          ].join('\\n');
          if (style.textContent !== shellCss) {
            style.textContent = shellCss;
          }
        }

        function hideNode(node) {
          if (!node || !node.style) return;
          node.style.setProperty('display', 'none', 'important');
          node.style.setProperty('visibility', 'hidden', 'important');
          node.style.setProperty('height', '0', 'important');
          node.style.setProperty('margin', '0', 'important');
          node.style.setProperty('padding', '0', 'important');
          node.classList.add('rid-mac-hidden-brand');
        }

        function markCardAround(node) {
          var current = node;
          for (var index = 0; current && index < 5; index += 1) {
            var rect = current.getBoundingClientRect ? current.getBoundingClientRect() : null;
            var style = window.getComputedStyle ? window.getComputedStyle(current) : null;
            if (
              rect &&
              rect.width > 220 &&
              style &&
              (parseFloat(style.borderRadius || '0') > 8 || style.borderStyle !== 'none')
            ) {
              current.classList.add('rid-admin-mobile-card');
              return current;
            }
            current = current.parentElement;
          }
          return null;
        }

        function tidyAdminLayout() {
          if (!document.body) return;

          var bodyText = document.body.innerText || '';
          var isAdminScreen = bodyText.indexOf('관리자') >= 0 && (
            bodyText.indexOf('초대') >= 0 ||
            bodyText.indexOf('제거된 사람') >= 0 ||
            bodyText.indexOf('입장한 사람') >= 0
          );

          document.documentElement.classList.toggle('rid-mac-admin-mobile', isAdminScreen);
          if (!isAdminScreen) return;

          document.documentElement.style.setProperty('overflow-x', 'hidden', 'important');
          document.body.style.setProperty('overflow-x', 'hidden', 'important');
          document.body.style.setProperty('width', '100%', 'important');

          var nodes = Array.prototype.slice.call(document.body.querySelectorAll('*'));
          nodes.forEach(function (node) {
            var rect = node.getBoundingClientRect ? node.getBoundingClientRect() : null;
            if (!rect || rect.width < 220) return;

            var style = window.getComputedStyle ? window.getComputedStyle(node) : null;
            if (!style) return;

            if (style.display === 'grid' && rect.width > 320) {
              node.classList.add('rid-admin-mobile-grid');
              node.style.setProperty('grid-template-columns', 'minmax(0, 1fr)', 'important');
              node.style.setProperty('width', '100%', 'important');
              node.style.setProperty('max-width', '100%', 'important');
            }

            if (style.display.indexOf('flex') >= 0 && rect.width > 320) {
              node.style.setProperty('flex-wrap', 'wrap', 'important');
              node.style.setProperty('max-width', '100%', 'important');
              node.style.setProperty('min-width', '0', 'important');
            }

            if (node.scrollWidth > node.clientWidth + 12) {
              node.style.setProperty('max-width', '100%', 'important');
              node.style.setProperty('min-width', '0', 'important');
              node.style.setProperty('overflow-x', 'hidden', 'important');
            }
          });

          ['초대 링크', '입장한 사람', '초대 완료', '대기 중 초대', '제거된 사람', '데이터 관리'].forEach(function (label) {
            nodes.forEach(function (node) {
              if ((node.textContent || '').trim() === label) {
                markCardAround(node);
              }
            });
          });

          nodes.forEach(function (node) {
            var text = (node.textContent || '').trim();
            if (text.indexOf('@') >= 0 || text.length > 22) {
              node.classList.add('rid-admin-mobile-field');
            }
          });
        }

        var isTidying = false;
        function tidyMobileHeader() {
          if (isTidying) return;
          isTidying = true;
          installShellStyle();
          if (!document.body) {
            isTidying = false;
            return;
          }
          tidyAdminLayout();

          var nodes = Array.prototype.slice.call(document.body ? document.body.querySelectorAll('*') : []);
          nodes.forEach(function (node) {
            var text = (node.textContent || '').trim();
            var rect = node.getBoundingClientRect ? node.getBoundingClientRect() : null;
            if (!rect || rect.top > 220) return;

            if (text === 'MOR') {
              node.textContent = '';
              hideNode(node);
            }

            if (text === '채팅' && rect.top < 150 && rect.height > 24) {
              node.classList.add('rid-mac-mobile-title-offset');
              node.style.setProperty('margin-left', '10px', 'important');
              node.style.setProperty('transform', 'translateX(8px)', 'important');
            }
          });

          try {
            var walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
            var textNode;
            while ((textNode = walker.nextNode())) {
              var value = textNode.nodeValue || '';
              if (value.trim() !== 'MOR') continue;
              var parent = textNode.parentElement;
              var rect = parent && parent.getBoundingClientRect ? parent.getBoundingClientRect() : null;
              if (rect && rect.top < 220) {
                textNode.nodeValue = '';
                hideNode(parent);
              }
            }
          } catch (error) {
            // Keep the app usable even if the page structure changes.
          }

          nodes.forEach(function (node) {
            var rect = node.getBoundingClientRect ? node.getBoundingClientRect() : null;
            if (!rect || rect.top > 220) return;
            if ((node.textContent || '').trim() === 'MOR') {
              node.textContent = '';
              hideNode(node);
            }
          });

          window.setTimeout(function () {
            isTidying = false;
          }, 50);
        }

        installShellStyle();
        document.addEventListener('DOMContentLoaded', tidyMobileHeader);
        window.addEventListener('load', tidyMobileHeader);
        window.addEventListener('resize', tidyMobileHeader);
        if (window.MutationObserver) {
          var tidyTimer = null;
          new MutationObserver(function () {
            if (tidyTimer) return;
            tidyTimer = window.setTimeout(function () {
              tidyTimer = null;
              tidyMobileHeader();
            }, 250);
          }).observe(document.documentElement, {
            childList: true,
            subtree: true
          });
        }
        setInterval(tidyMobileHeader, 1400);
      })();
      """,
      injectionTime: .atDocumentEnd,
      forMainFrameOnly: true
    )
    configuration.userContentController.addUserScript(viewportScript)

    webView = WKWebView(frame: .zero, configuration: configuration)
    webView.customUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1 RIDChatMobileMac/1.0.10"

    super.init(frame: frameRect)

    wantsLayer = true
    layer?.backgroundColor = NSColor(calibratedRed: 1.0, green: 0.965, blue: 0.982, alpha: 1.0).cgColor
    webView.navigationDelegate = self
    webView.uiDelegate = self
    webView.allowsBackForwardNavigationGestures = true
    webView.setValue(false, forKey: "drawsBackground")
    addSubview(webView)
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func layout() {
    super.layout()
    let width = min(bounds.width, mobileContentWidth)
    let x = max((bounds.width - width) / 2, 0)
    webView.frame = NSRect(
      x: x,
      y: 0,
      width: width,
      height: max(bounds.height - contentTopInset, 0)
    )
  }
}

extension MobileShellView: WKNavigationDelegate, WKUIDelegate {
  func webView(
    _ webView: WKWebView,
    decidePolicyFor navigationAction: WKNavigationAction,
    decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
  ) {
    guard let url = navigationAction.request.url else {
      decisionHandler(.allow)
      return
    }

    if url.host?.contains("ri-d.com") == true || url.scheme == "about" {
      decisionHandler(.allow)
      return
    }

    NSWorkspace.shared.open(url)
    decisionHandler(.cancel)
  }

  func webView(
    _ webView: WKWebView,
    runJavaScriptAlertPanelWithMessage message: String,
    initiatedByFrame frame: WKFrameInfo,
    completionHandler: @escaping () -> Void
  ) {
    let alert = NSAlert()
    alert.messageText = "알림"
    alert.informativeText = message
    alert.addButton(withTitle: "확인")
    alert.runModal()
    completionHandler()
  }

  func webView(
    _ webView: WKWebView,
    runJavaScriptConfirmPanelWithMessage message: String,
    initiatedByFrame frame: WKFrameInfo,
    completionHandler: @escaping (Bool) -> Void
  ) {
    let alert = NSAlert()
    alert.messageText = "확인"
    alert.informativeText = message
    alert.addButton(withTitle: "확인")
    alert.addButton(withTitle: "취소")
    completionHandler(alert.runModal() == .alertFirstButtonReturn)
  }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
  private var window: NSWindow?
  private var shellView: MobileShellView?

  func applicationDidFinishLaunching(_ notification: Notification) {
    NSApp.setActivationPolicy(.regular)

    let contentRect = NSRect(x: 0, y: 0, width: 462, height: 900)
    let window = NSWindow(
      contentRect: contentRect,
      styleMask: [.titled, .closable, .miniaturizable, .resizable],
      backing: .buffered,
      defer: false
    )
    window.title = "RID Chat"
    window.titlebarAppearsTransparent = true
    window.titleVisibility = .hidden
    window.isMovableByWindowBackground = true
    window.minSize = NSSize(width: 390, height: 680)
    window.setFrameAutosaveName("RIDChatMobileWindow")

    let shellView = MobileShellView(frame: contentRect)
    window.contentView = shellView
    window.center()
    window.makeKeyAndOrderFront(nil)

    shellView.webView.load(URLRequest(url: messengerURL))

    self.window = window
    self.shellView = shellView
    NSApp.activate(ignoringOtherApps: true)
  }

  func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
    true
  }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
