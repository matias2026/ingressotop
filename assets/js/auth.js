document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("loginForm");

    if (!form) return;

    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const submitButton = document.getElementById("loginSubmitButton");

    window.ativarRevalidacaoAoDigitar?.(emailInput, (input) =>
        window.validarCampoEmail(input)
    );

    window.ativarRevalidacaoAoDigitar?.(passwordInput, (input) =>
        window.validarCampoObrigatorio(input, "Digite sua senha.")
    );

    form.addEventListener("submit", async (e) => {

        e.preventDefault();

        const emailValido = window.validarCampoEmail(emailInput);
        const senhaValida = window.validarCampoObrigatorio(
            passwordInput,
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
            window.mostrarToast(
                "Confirme que você não é um robô.",
                "erro"
            );
            return;
        }

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        submitButton.disabled = true;
        submitButton.textContent = "Entrando...";

        try {
            const resposta = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, recaptchaToken })
            });

            const resultado = await resposta.json().catch(() => ({}));

            if (!resposta.ok) {
                window.mostrarToast(
                    resultado.erro ||
                        "Não foi possível entrar. Confira o e-mail e a senha.",
                    "erro"
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
                window.mostrarToast(
                    "Não foi possível entrar. Tente novamente.",
                    "erro"
                );
                window.grecaptcha?.reset();
                return;
            }

            const { data: perfil } = await supabaseClient
                .from("profiles")
                .select("role")
                .eq("id", sessionData.user.id)
                .maybeSingle();

            window.location.href =
                perfil?.role === "admin"
                    ? "admin/eventos-pendentes.html"
                    : "organizador/index.html";
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Entrar";
        }

    });

    const forgotLink = document.getElementById("forgotPasswordLink");
    const forgotForm = document.getElementById("forgotPasswordForm");
    const cancelForgot = document.getElementById("cancelForgotPassword");
    const forgotMessage = document.getElementById("forgotMessage");
    const forgotEmailInput = document.getElementById("forgotEmail");

    if (forgotLink && forgotForm) {

        window.ativarRevalidacaoAoDigitar?.(forgotEmailInput, (input) =>
            window.validarCampoEmail(input)
        );

        forgotLink.addEventListener("click", (e) => {
            e.preventDefault();
            form.classList.add("hidden");
            forgotLink.classList.add("hidden");
            forgotForm.classList.remove("hidden");
            forgotMessage.classList.add("hidden");
        });

        cancelForgot?.addEventListener("click", (e) => {
            e.preventDefault();
            forgotForm.classList.add("hidden");
            form.classList.remove("hidden");
            forgotLink.classList.remove("hidden");
            forgotMessage.classList.add("hidden");
        });

        forgotForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            if (!window.validarCampoEmail(forgotEmailInput)) {
                return;
            }

            const email = forgotEmailInput.value.trim();
            const submitButton = forgotForm.querySelector("button[type='submit']");

            submitButton.disabled = true;
            submitButton.textContent = "Enviando...";

            const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + "/login.html"
            });

            submitButton.disabled = false;
            submitButton.textContent = "Enviar link de redefinição";

            forgotMessage.classList.remove("hidden", "success", "error");

            if (error) {
                forgotMessage.classList.add("error");
                forgotMessage.textContent = error.message;
                return;
            }

            forgotMessage.classList.add("success");
            forgotMessage.textContent =
                "Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha.";

            forgotForm.reset();
        });
    }

});
const registerForm = document.getElementById("registerForm");

if (registerForm) {

    const nameInput = document.getElementById("name");
    const registerEmailInput = document.getElementById("email");
    const registerPasswordInput = document.getElementById("password");

    window.ativarRevalidacaoAoDigitar?.(nameInput, (input) =>
        window.validarCampoObrigatorio(input, "Digite seu nome completo.")
    );

    window.ativarRevalidacaoAoDigitar?.(registerEmailInput, (input) =>
        window.validarCampoEmail(input)
    );

    window.ativarRevalidacaoAoDigitar?.(registerPasswordInput, (input) => {
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

    registerForm.addEventListener("submit", async (e) => {

        e.preventDefault();

        const nomeValido = window.validarCampoObrigatorio(
            nameInput,
            "Digite seu nome completo."
        );

        const emailValido = window.validarCampoEmail(registerEmailInput);

        let senhaValida = true;
        if (registerPasswordInput.value.trim().length < 6) {
            window.mostrarErroCampo(
                registerPasswordInput,
                "A senha precisa ter pelo menos 6 caracteres."
            );
            senhaValida = false;
        } else {
            window.limparErroCampo(registerPasswordInput);
        }

        if (!nomeValido || !emailValido || !senhaValida) {
            window.mostrarToast(
                "Confira os campos destacados antes de continuar.",
                "erro"
            );
            return;
        }

        const name = nameInput.value.trim();
        const email = registerEmailInput.value.trim();
        const password = registerPasswordInput.value;

        const { error } = await supabaseClient.auth.signUp({

            email,

            password,

            options: {

                data: {

                    full_name: name

                }

            }

        });

        if (error) {

            window.mostrarToast(
                error.message || "Não foi possível criar a conta.",
                "erro"
            );

            return;

        }

        window.mostrarToast(
            "Conta criada! Seu cadastro de organizador vai passar por " +
            "uma revisão antes de liberar o painel.",
            "sucesso",
            5000
        );

        setTimeout(() => {
            window.location.href = "login.html";
        }, 1500);

    });

}
