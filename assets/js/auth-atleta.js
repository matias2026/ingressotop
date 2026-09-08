document.addEventListener("DOMContentLoaded", () => {

    const tabEntrar = document.getElementById("tabEntrar");
    const tabCriarConta = document.getElementById("tabCriarConta");
    const loginForm = document.getElementById("loginAtletaForm");
    const cadastroForm = document.getElementById("cadastroAtletaForm");
    const forgotLink = document.getElementById("forgotPasswordLink");
    const forgotForm = document.getElementById("forgotPasswordForm");
    const cancelForgot = document.getElementById("cancelForgotPassword");
    const authMessage = document.getElementById("authMessage");

    function mostrarAba(aba) {
        const ehLogin = aba === "login";

        tabEntrar.classList.toggle("active", ehLogin);
        tabCriarConta.classList.toggle("active", !ehLogin);

        loginForm.classList.toggle("hidden", !ehLogin);
        forgotLink.classList.toggle("hidden", !ehLogin);
        cadastroForm.classList.toggle("hidden", ehLogin);

        forgotForm.classList.add("hidden");
        authMessage.classList.add("hidden");
    }

    tabEntrar.addEventListener("click", () => mostrarAba("login"));
    tabCriarConta.addEventListener("click", () => mostrarAba("cadastro"));

    function mostrarMensagem(texto, tipo) {
        authMessage.textContent = texto;
        authMessage.className = `forgot-message ${tipo}`;
    }

    function redirecionarPorPapel(role) {
        if (role === "admin") {
            window.location.href = "admin/eventos-pendentes.html";
        } else if (role === "organizador") {
            window.location.href = "organizador/index.html";
        } else {
            window.location.href = "minhas-inscricoes.html";
        }
    }

    const loginEmailInput = document.getElementById("loginEmail");
    const loginSenhaInput = document.getElementById("loginSenha");
    const loginSubmitButton = document.getElementById("loginAtletaSubmitButton");

    window.ativarRevalidacaoAoDigitar?.(loginEmailInput, (input) =>
        window.validarCampoEmail(input)
    );

    window.ativarRevalidacaoAoDigitar?.(loginSenhaInput, (input) =>
        window.validarCampoObrigatorio(input, "Digite sua senha.")
    );

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const emailValido = window.validarCampoEmail(loginEmailInput);
        const senhaValida = window.validarCampoObrigatorio(
            loginSenhaInput,
            "Digite sua senha."
        );

        if (!emailValido || !senhaValida) {
            window.mostrarToast(
                "Confira os campos destacados antes de continuar.",
                "erro"
            );
            return;
        }

        const recaptchaToken = window.grecaptcha?.getResponse();

        if (!recaptchaToken) {
            mostrarMensagem(
                "Confirme que você não é um robô.",
                "error"
            );
            return;
        }

        const email = loginEmailInput.value.trim();
        const senha = loginSenhaInput.value;

        loginSubmitButton.disabled = true;
        loginSubmitButton.textContent = "Entrando...";

        try {
            const resposta = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password: senha, recaptchaToken })
            });

            const resultado = await resposta.json().catch(() => ({}));

            if (!resposta.ok) {
                mostrarMensagem(
                    resultado.erro || "E-mail ou senha incorretos.",
                    "error"
                );
                window.grecaptcha?.reset();
                return;
            }

            const { data: sessionData, error: erroSessao } =
                await supabaseClient.auth.setSession({
                    access_token: resultado.access_token,
                    refresh_token: resultado.refresh_token
                });

            if (erroSessao) {
                mostrarMensagem(
                    "Não foi possível entrar. Tente novamente.",
                    "error"
                );
                window.grecaptcha?.reset();
                return;
            }

            const { data: perfil } = await supabaseClient
                .from("profiles")
                .select("role")
                .eq("id", sessionData.user.id)
                .maybeSingle();

            redirecionarPorPapel(perfil?.role);
        } finally {
            loginSubmitButton.disabled = false;
            loginSubmitButton.textContent = "Entrar";
        }
    });

    const cadastroNomeInput = document.getElementById("cadastroNome");
    const cadastroEmailInput = document.getElementById("cadastroEmail");
    const cadastroSenhaInput = document.getElementById("cadastroSenha");

    window.ativarRevalidacaoAoDigitar?.(cadastroNomeInput, (input) =>
        window.validarCampoObrigatorio(input, "Digite seu nome completo.")
    );

    window.ativarRevalidacaoAoDigitar?.(cadastroEmailInput, (input) =>
        window.validarCampoEmail(input)
    );

    window.ativarRevalidacaoAoDigitar?.(cadastroSenhaInput, (input) => {
        if (input.value.trim().length < 6) {
            window.mostrarErroCampo(
                input,
                "A senha precisa ter pelo menos 6 caracteres."
            );
            return false;
        }
        window.limparErroCampo(input);
        return true;
    });

    cadastroForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const nomeValido = window.validarCampoObrigatorio(
            cadastroNomeInput,
            "Digite seu nome completo."
        );
        const emailValido = window.validarCampoEmail(cadastroEmailInput);

        let senhaValida = true;
        if (cadastroSenhaInput.value.trim().length < 6) {
            window.mostrarErroCampo(
                cadastroSenhaInput,
                "A senha precisa ter pelo menos 6 caracteres."
            );
            senhaValida = false;
        } else {
            window.limparErroCampo(cadastroSenhaInput);
        }

        if (!nomeValido || !emailValido || !senhaValida) {
            window.mostrarToast(
                "Confira os campos destacados antes de continuar.",
                "erro"
            );
            return;
        }

        const nome = cadastroNomeInput.value.trim();
        const email = cadastroEmailInput.value.trim();
        const senha = cadastroSenhaInput.value;

        const { error } = await supabaseClient.auth.signUp({
            email,
            password: senha,
            options: {
                data: {
                    full_name: nome,
                    tipo_conta: "atleta"
                }
            }
        });

        if (error) {
            mostrarMensagem(error.message, "error");
            return;
        }

        mostrarAba("login");
        mostrarMensagem(
            "Conta criada! Já dá pra entrar com seu e-mail e senha.",
            "success"
        );
    });

    forgotLink.addEventListener("click", (e) => {
        e.preventDefault();
        loginForm.classList.add("hidden");
        forgotLink.classList.add("hidden");
        forgotForm.classList.remove("hidden");
        authMessage.classList.add("hidden");
    });

    cancelForgot.addEventListener("click", (e) => {
        e.preventDefault();
        forgotForm.classList.add("hidden");
        loginForm.classList.remove("hidden");
        forgotLink.classList.remove("hidden");
        authMessage.classList.add("hidden");
    });

    const forgotEmailInput = document.getElementById("forgotEmail");

    window.ativarRevalidacaoAoDigitar?.(forgotEmailInput, (input) =>
        window.validarCampoEmail(input)
    );

    forgotForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (!window.validarCampoEmail(forgotEmailInput)) {
            return;
        }

        const email = forgotEmailInput.value.trim();
        const botao = forgotForm.querySelector("button[type='submit']");

        botao.disabled = true;
        botao.textContent = "Enviando...";

        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + "/minha-conta.html"
        });

        botao.disabled = false;
        botao.textContent = "Enviar link de redefinição";

        if (error) {
            mostrarMensagem(error.message, "error");
            return;
        }

        mostrarMensagem(
            "Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha.",
            "success"
        );

        forgotForm.reset();
    });

});
