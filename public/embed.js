(function () {
  var ORIGIN = "https://herbally.app";

  function buildFrame(locale, maxWidth) {
    var fr = locale === "fr";
    var iframe = document.createElement("iframe");
    iframe.src = ORIGIN + (fr ? "/fr/embed/checker" : "/embed/checker");
    iframe.width = "100%";
    iframe.height = "440";
    iframe.loading = "lazy";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.setAttribute(
      "sandbox",
      "allow-scripts allow-same-origin allow-forms allow-popups"
    );
    iframe.title = fr
      ? "Vérificateur d'interactions plante-médicament par HerbAlly"
      : "Herb-drug interaction checker by HerbAlly";
    var widthCss = maxWidth || "480px";
    if (/^\d+$/.test(widthCss)) {
      widthCss = widthCss + "px";
    }
    iframe.style.cssText =
      "border:0;border-radius:16px;width:100%;max-width:" +
      widthCss +
      ";display:block";
    return iframe;
  }

  function mountContainer(container) {
    if (!container || container.getAttribute("data-herbally-mounted") === "1") {
      return;
    }
    var locale =
      container.getAttribute("locale") ||
      container.getAttribute("data-locale") ||
      "en";
    var maxWidth =
      container.getAttribute("max-width") ||
      container.getAttribute("data-max-width") ||
      "480px";
    container.setAttribute("data-herbally-mounted", "1");
    container.innerHTML = "";
    container.appendChild(buildFrame(locale, maxWidth));
  }

  if (
    typeof window !== "undefined" &&
    "customElements" in window &&
    !window.customElements.get("herbally-checker")
  ) {
    function HerballyCheckerElement() {
      return Reflect.construct(HTMLElement, [], HerballyCheckerElement);
    }
    HerballyCheckerElement.prototype = Object.create(HTMLElement.prototype);
    HerballyCheckerElement.prototype.constructor = HerballyCheckerElement;
    HerballyCheckerElement.prototype.connectedCallback = function () {
      mountContainer(this);
    };
    window.customElements.define("herbally-checker", HerballyCheckerElement);
  }

  if (typeof document !== "undefined") {
    var existing = document.querySelectorAll(
      "[data-herbally-checker], herbally-checker"
    );
    for (var i = 0; i < existing.length; i++) {
      mountContainer(existing[i]);
    }
  }
})();
