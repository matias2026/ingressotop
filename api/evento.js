const SUPABASE_URL = "https://ymaybqujglfajllruqub.supabase.co";
const SUPABASE_PUBLIC_KEY = "sb_publishable_l3qNE9dzBeefjdKpRyzVOg_bkm51ZI4";
const LOGO_PADRAO = "https://www.corraagora.com.br/images/logo-corraagora-trim.png";

function escapeHtml(texto) {
  return String(texto || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatarData(dataISO) {
  const partes = String(dataISO || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!partes) return "";
  const [, ano, mes, dia] = partes;
  return `${dia}/${mes}/${ano}`;
}

function formatarMoeda(valor) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(valor);
}

async function buscarCategorias(eventoId) {
  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/categorias?evento_id=eq.${encodeURIComponent(
        eventoId
      )}&select=nome,percurso,valor&order=ordem.asc`,
      {
        headers: {
          apikey: SUPABASE_PUBLIC_KEY,
          Authorization: `Bearer ${SUPABASE_PUBLIC_KEY}`
        }
      }
    );
    const categorias = await resp.json();
    return Array.isArray(categorias) ? categorias : [];
  } catch (erro) {
    return [];
  }
}

async function buscarNomeOrganizador(organizadorId) {
  if (!organizadorId) return null;

  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/organizadores_publicos?id=eq.${encodeURIComponent(
        organizadorId
      )}&select=full_name`,
      {
        headers: {
          apikey: SUPABASE_PUBLIC_KEY,
          Authorization: `Bearer ${SUPABASE_PUBLIC_KEY}`
        }
      }
    );
    const linhas = await resp.json();
    return Array.isArray(linhas) && linhas[0] ? linhas[0].full_name : null;
  } catch (erro) {
    return null;
  }
}

function precoMinimoDe(categorias) {
  const valores = categorias
    .map((c) => Number(c.valor))
    .filter((v) => !Number.isNaN(v) && v >= 0);

  return valores.length ? Math.min(...valores) : null;
}

function montarDataHoraISO(dataEvento, horarioEvento) {
  if (!dataEvento) return null;
  const hora = horarioEvento || "00:00:00";
  // Sem fuso horário explícito no banco — usamos o horário de Brasília (-03:00),
  // já que é o público-alvo do site inteiro.
  return `${dataEvento}T${hora}-03:00`;
}

function montarJsonLd({ evento, urlEvento, imagem, nomeOrganizador, categorias }) {
  const dataHoraISO = montarDataHoraISO(evento.data_evento, evento.horario_evento);

  const local = {
    "@type": "Place",
    name: evento.endereco || evento.cidade || "Local a definir",
    address: {
      "@type": "PostalAddress",
      addressLocality: evento.cidade || undefined,
      addressRegion: evento.estado || undefined,
      addressCountry: "BR"
    }
  };

  const precoMinimo = precoMinimoDe(categorias);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: evento.nome || "Evento esportivo",
    description: evento.descricao || `${evento.nome} — evento esportivo na CorraAgora.`,
    image: imagem,
    url: urlEvento,
    startDate: dataHoraISO || undefined,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: local,
    organizer: nomeOrganizador
      ? { "@type": "Organization", name: nomeOrganizador }
      : undefined,
    offers:
      precoMinimo === null
        ? undefined
        : {
            "@type": "Offer",
            price: precoMinimo,
            priceCurrency: "BRL",
            url: urlEvento,
            availability: "https://schema.org/InStock"
          },
    // Cada categoria vira um "sub-evento" — é como o schema.org representa
    // as diferentes distâncias/percursos dentro do mesmo evento principal.
    subEvent: categorias.length
      ? categorias.map((categoria) => ({
          "@type": "SportsEvent",
          name: categoria.percurso
            ? `${categoria.nome} — ${categoria.percurso}`
            : categoria.nome,
          startDate: dataHoraISO || undefined,
          location: local
        }))
      : undefined
  };

  return jsonLd;
}

module.exports = async (req, res) => {
  const protocolo = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  const baseUrl = `${protocolo}://${host}`;
  const slug =
    typeof req.query.slug === "string" ? req.query.slug.trim() : "";

  let html;
  try {
    const respHtml = await fetch(`${baseUrl}/evento-app.html`);
    html = await respHtml.text();
  } catch (erro) {
    res.status(502).send("Erro ao carregar a página do evento.");
    return;
  }

  if (slug) {
    try {
      const respEvento = await fetch(
        `${SUPABASE_URL}/rest/v1/eventos?slug=eq.${encodeURIComponent(
          slug
        )}&status=eq.aprovado&select=id,nome,modalidade,cidade,estado,endereco,data_evento,horario_evento,descricao,banner_url,organizador_id`,
        {
          headers: {
            apikey: SUPABASE_PUBLIC_KEY,
            Authorization: `Bearer ${SUPABASE_PUBLIC_KEY}`
          }
        }
      );
      const eventos = await respEvento.json();
      const evento = Array.isArray(eventos) ? eventos[0] : null;

      if (evento) {
        const nome = evento.nome || "Evento esportivo";
        const cidadeEstado = [evento.cidade, evento.estado]
          .filter(Boolean)
          .join(" - ");
        const dataFormatada = formatarData(evento.data_evento);
        const categorias = await buscarCategorias(evento.id);
        const precoMinimo = precoMinimoDe(categorias);
        const precoFormatado =
          precoMinimo === null
            ? null
            : precoMinimo === 0
            ? "Gratuito"
            : `A partir de ${formatarMoeda(precoMinimo)}`;

        const partesDescricao = [
          evento.modalidade || "Evento esportivo",
          cidadeEstado || null,
          dataFormatada || null,
          precoFormatado
        ].filter(Boolean);

        const titulo = `${nome} | CorraAgora`;
        const descricao = `${partesDescricao.join(
          " • "
        )}. Inscreva-se agora na CorraAgora!`;
        const imagem = evento.banner_url || LOGO_PADRAO;
        const urlEvento = `${baseUrl}/evento.html?slug=${encodeURIComponent(
          slug
        )}`;

        const tituloEsc = escapeHtml(titulo);
        const descricaoEsc = escapeHtml(descricao);
        const imagemEsc = escapeHtml(imagem);
        const urlEsc = escapeHtml(urlEvento);

        const novoBloco = `<!-- OG_META_START -->
  <!-- Open Graph / redes sociais (WhatsApp, Facebook, LinkedIn) -->
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="CorraAgora">
  <meta property="og:title" content="${tituloEsc}">
  <meta property="og:description" content="${descricaoEsc}">
  <meta property="og:url" content="${urlEsc}">
  <meta property="og:image" content="${imagemEsc}">
  <meta property="og:locale" content="pt_BR">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${tituloEsc}">
  <meta name="twitter:description" content="${descricaoEsc}">
  <meta name="twitter:image" content="${imagemEsc}">
  <!-- OG_META_END -->`;

        html = html.replace(
          /<!-- OG_META_START -->[\s\S]*?<!-- OG_META_END -->/,
          novoBloco
        );

        html = html.replace(
          /<title>[^<]*<\/title>/,
          `<title>${tituloEsc}</title>`
        );

        const nomeOrganizador = await buscarNomeOrganizador(
          evento.organizador_id
        );

        const jsonLd = montarJsonLd({
          evento,
          urlEvento,
          imagem,
          nomeOrganizador,
          categorias
        });

        // JSON.stringify normal deixaria a string "</script>" passar direto
        // se aparecesse dentro de algum texto do organizador — isso fecharia
        // a tag cedo demais. Escapar a barra evita esse problema.
        const jsonLdSeguro = JSON.stringify(jsonLd).replace(/<\/script>/gi, "<\\/script>");

        const blocoJsonLd = `<!-- JSONLD_START -->
  <script type="application/ld+json">${jsonLdSeguro}</script>
  <!-- JSONLD_END -->`;

        html = html.replace(
          /<!-- JSONLD_START -->[\s\S]*?<!-- JSONLD_END -->/,
          blocoJsonLd
        );
      }
    } catch (erro) {
      // Mantém o HTML padrão (tags genéricas) se a busca do evento falhar.
    }
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader(
    "Cache-Control",
    "public, max-age=0, s-maxage=600, stale-while-revalidate=3600"
  );
  res.status(200).send(html);
};
