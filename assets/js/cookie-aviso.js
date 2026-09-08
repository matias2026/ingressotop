// Aviso informativo de cookies (LGPD) — não bloqueia nada, só avisa.
// Autossuficiente de propósito: injeta seu próprio estilo, pra funcionar
// igual em qualquer página do site, mesmo as que não carregam style.css.
(() => {
  "use strict";

  const CHAVE_STORAGE = "corraagora_cookie_aviso_visto";

  let jaVisto = false;
  try {
    jaVisto = localStorage.getItem(CHAVE_STORAGE) === "1";
  } catch (erro) {
    // localStorage bloqueado (modo privado/restrito) — mostra o aviso mesmo assim.
  }

  if (jaVisto) return;

  function montarFaixa() {
    if (document.getElementById("corraagora-cookie-aviso")) return;

    const estilo = document.createElement("style");
    estilo.textContent = `
      #corraagora-cookie-aviso{position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#0a0f18;color:#fff;padding:16px 20px;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:14px 20px;font-family:Inter,system-ui,-apple-system,sans-serif;box-shadow:0 -8px 24px rgba(0,0,0,.18)}
      #corraagora-cookie-aviso p{margin:0;font-size:13.5px;line-height:1.5;max-width:640px;color:#e5eaf0}
      #corraagora-cookie-aviso a{color:#79baff;text-decoration:underline}
      #corraagora-cookie-aviso button{flex-shrink:0;border:0;border-radius:10px;padding:10px 20px;font-weight:700;font-size:13.5px;background:linear-gradient(135deg,#3d95f7,#79baff);color:#fff;cursor:pointer}
    `;
    document.head.appendChild(estilo);

    const faixa = document.createElement("div");
    faixa.id = "corraagora-cookie-aviso";
    faixa.setAttribute("role", "region");
    faixa.setAttribute("aria-label", "Aviso de cookies");
    faixa.innerHTML = `
      <p>
        Usamos cookies apenas para manter sua sessão ativa — não usamos
        cookies de rastreamento de terceiros. Saiba mais na nossa
        <a href="/privacidade.html">Política de Privacidade</a>.
      </p>
      <button type="button">Entendi</button>
    `;

    document.body.appendChild(faixa);

    faixa.querySelector("button").addEventListener("click", () => {
      faixa.remove();
      try {
        localStorage.setItem(CHAVE_STORAGE, "1");
      } catch (erro) {
        // Sem localStorage, o aviso só volta a aparecer na próxima visita.
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", montarFaixa);
  } else {
    montarFaixa();
  }
})();
