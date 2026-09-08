// Faz o login (organizador ou atleta — a lógica é idêntica pros dois) só
// depois de confirmar o reCAPTCHA v2 ("Não sou um robô"). A verificação
// do token tem que acontecer aqui no servidor — no navegador, qualquer
// script poderia chamar o Supabase direto e pular a caixinha.

const SUPABASE_URL = "https://ymaybqujglfajllruqub.supabase.co";
const SUPABASE_PUBLIC_KEY = "sb_publishable_l3qNE9dzBeefjdKpRyzVOg_bkm51ZI4";

async function verificarRecaptchaV2(token, ip) {
  const params = new URLSearchParams({
    secret: process.env.RECAPTCHA_LOGIN_SECRET_KEY,
    response: token
  });
  if (ip) params.set("remoteip", ip);

  const resp = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });

  return resp.json();
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ erro: "Método não permitido." });
    return;
  }

  const corpo = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const { email, password, recaptchaToken } = corpo;

  if (!recaptchaToken || typeof recaptchaToken !== "string") {
    res.status(400).json({ erro: "Confirme que você não é um robô." });
    return;
  }

  if (!email || !password) {
    res.status(400).json({ erro: "Informe e-mail e senha." });
    return;
  }

  try {
    const ip =
      (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || undefined;

    const resultadoCaptcha = await verificarRecaptchaV2(recaptchaToken, ip);

    if (!resultadoCaptcha.success) {
      console.error("reCAPTCHA v2 reprovado:", resultadoCaptcha);
      res.status(400).json({
        erro: "Não foi possível confirmar que você não é um robô. Marque a caixinha e tente de novo."
      });
      return;
    }
  } catch (erro) {
    console.error("Erro ao verificar reCAPTCHA v2:", erro);
    res.status(502).json({
      erro: "Não foi possível validar o reCAPTCHA agora. Tente novamente."
    });
    return;
  }

  try {
    const respLogin = await fetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_PUBLIC_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      }
    );

    const dadosLogin = await respLogin.json();

    if (!respLogin.ok) {
      res.status(401).json({ erro: "E-mail ou senha incorretos." });
      return;
    }

    res.status(200).json({
      access_token: dadosLogin.access_token,
      refresh_token: dadosLogin.refresh_token
    });
  } catch (erro) {
    console.error("Erro ao autenticar:", erro);
    res.status(502).json({
      erro: "Não foi possível entrar agora. Tente novamente."
    });
  }
};
