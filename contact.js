/* ==========================================================================
   FORMULARIO DE CONTACTO — MJV Studio

   ⚠️ LO ÚNICO QUE HAY QUE COMPLETAR ESTÁ ACÁ ARRIBA (config).
   El resto no hace falta tocarlo.

   Cómo funciona el envío:
   - Si formEndpoint está completo → el mensaje se manda a ese servicio
     (Formspree, Web3Forms, etc.) y el servicio te lo reenvía a tu correo.
   - Si formEndpoint está vacío → como respaldo, se abre el programa de
     correo de la persona con el mensaje ya armado, dirigido a "email".
   ========================================================================== */

const MJV_CONTACT_CONFIG = {
    // Correo del estudio: se usa como destino del respaldo y se muestra
    // al pie del formulario para que se pueda copiar.
    email: 'tucorreo@example.com',

    // URL que te da el servicio de formularios. Ejemplo con Formspree:
    //   'https://formspree.io/f/xxxxxxxx'
    // Con Web3Forms es siempre 'https://api.web3forms.com/submit'
    formEndpoint: 'https://formspree.io/f/xgaoejlz',

    // Solo para Web3Forms: la "access key" que te dan al registrarte.
    // Con Formspree dejala vacía.
    accessKey: ''
};

(function () {
    var cfg = MJV_CONTACT_CONFIG;

    // Mensajes que arma el código (los textos fijos del HTML se traducen
    // con data-en, como en el resto del sitio).
    var MSG = {
        es: {
            sending: 'Enviando…',
            required: 'Completá este campo.',
            nameInvalid: 'Ingresá un nombre válido.',
            lastnameInvalid: 'Ingresá un apellido válido.',
            contactInvalid: 'Ingresá un email o un teléfono válido.',
            serviceRequired: 'Elegí un servicio.',
            mailtoOpened: 'Se abrió tu programa de correo con el mensaje listo para enviar.',
            sendError: 'No pudimos enviar el mensaje. Probá de nuevo en un rato o escribinos por WhatsApp.'
        },
        en: {
            sending: 'Sending…',
            required: 'Please fill in this field.',
            nameInvalid: 'Enter a valid first name.',
            lastnameInvalid: 'Enter a valid last name.',
            contactInvalid: 'Enter a valid email or phone number.',
            serviceRequired: 'Choose a service.',
            mailtoOpened: 'Your email app opened with the message ready to send.',
            sendError: "We couldn't send your message. Please try again later or reach us on WhatsApp."
        },
        fr: {
            sending: 'Envoi en cours…',
            required: 'Veuillez remplir ce champ.',
            nameInvalid: 'Saisissez un prénom valide.',
            lastnameInvalid: 'Saisissez un nom valide.',
            contactInvalid: 'Saisissez une adresse e-mail ou un numéro de téléphone valide.',
            serviceRequired: 'Choisissez un service.',
            mailtoOpened: "Votre application de messagerie s'est ouverte avec le message prêt à être envoyé.",
            sendError: "Nous n'avons pas pu envoyer le message. Réessayez dans un moment ou écrivez-nous sur WhatsApp."
        },
        pt: {
            sending: 'Enviando…',
            required: 'Preencha este campo.',
            nameInvalid: 'Digite um nome válido.',
            lastnameInvalid: 'Digite um sobrenome válido.',
            contactInvalid: 'Digite um e-mail ou telefone válido.',
            serviceRequired: 'Escolha um serviço.',
            mailtoOpened: 'Seu aplicativo de e-mail foi aberto com a mensagem pronta para enviar.',
            sendError: 'Não foi possível enviar a mensagem. Tente novamente em instantes ou fale conosco pelo WhatsApp.'
        }
    };

    function lang() {
        var l = window.mjvLang ? window.mjvLang.current() : 'es';
        return MSG[l] ? l : 'es';
    }
    function t(key) { return MSG[lang()][key]; }

    function isEmail(value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
    }
    // Un nombre/apellido válido: al menos 2 caracteres y alguna letra
    // (acepta tildes, ñ, otros alfabetos). Rechaza "a", "123", "---".
    function isName(value) {
        return value.length >= 2 && /\p{L}/u.test(value);
    }
    function isPhone(value) {
        var digits = value.replace(/\D/g, '');
        return /^[\d\s()+\-.]+$/.test(value) && digits.length >= 7 && digits.length <= 15;
    }

    document.addEventListener('DOMContentLoaded', function () {
        var overlay = document.getElementById('contact-modal-overlay');
        var form = document.getElementById('contact-form');
        var trigger = document.getElementById('open-contact-form');
        if (!overlay || !form) return;

        var closeBtn = document.getElementById('contact-modal-close');
        var closeSuccessBtn = document.getElementById('cf-close-success');
        var submitBtn = document.getElementById('cf-submit');
        var statusEl = document.getElementById('cf-status');
        var emailText = document.getElementById('cf-email-text');

        // La línea "O escribinos directo: mail" solo se muestra si ya cargaste
        // el mail real del estudio (así no se ve el mail de ejemplo en público).
        var altLine = document.querySelector('.cf-alt');
        var emailIsPlaceholder = !cfg.email || /example\.com$/i.test(cfg.email);
        if (emailIsPlaceholder) {
            if (altLine) altLine.style.display = 'none';
        } else if (emailText) {
            emailText.textContent = cfg.email;
        }

        /* ---------- abrir / cerrar ---------- */
        function openForm() {
            overlay.classList.add('open');
            if (window.mjvSound) window.mjvSound.pop();
            setTimeout(function () {
                var first = document.getElementById('cf-name');
                if (first) first.focus();
            }, 60);
        }

        function closeForm() {
            overlay.classList.remove('open');
            if (trigger) trigger.blur();
            // Si ya se envió, la próxima vez que se abra arranca limpio
            if (overlay.classList.contains('is-sent')) {
                overlay.classList.remove('is-sent');
                form.reset();
                clearErrors();
                setStatus('');
            }
        }

        if (trigger) {
            trigger.addEventListener('click', function (e) {
                e.preventDefault();
                openForm();
            });
        }
        if (closeBtn) closeBtn.addEventListener('click', closeForm);
        if (closeSuccessBtn) closeSuccessBtn.addEventListener('click', closeForm);
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeForm();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && overlay.classList.contains('open')) closeForm();
        });

        /* ---------- validación ---------- */
        function setFieldError(input, message) {
            var field = input.closest('.cf-field');
            if (!field) return;
            var err = field.querySelector('.cf-error');
            field.classList.toggle('has-error', !!message);
            if (err) err.textContent = message || '';
            input.setAttribute('aria-invalid', message ? 'true' : 'false');
        }

        function clearErrors() {
            form.querySelectorAll('.cf-field').forEach(function (field) {
                field.classList.remove('has-error');
                var err = field.querySelector('.cf-error');
                if (err) err.textContent = '';
                var input = field.querySelector('input, select, textarea');
                if (input) input.removeAttribute('aria-invalid');
            });
        }

        function setStatus(message, kind) {
            statusEl.textContent = message || '';
            statusEl.className = 'cf-status' + (kind ? ' ' + kind : '');
        }

        function validate() {
            var ok = true;
            var firstInvalid = null;
            var name = form.elements['nombre'];
            var lastname = form.elements['apellido'];
            var contact = form.elements['contacto'];
            var service = form.elements['servicio'];
            var message = form.elements['mensaje'];

            function fail(input, text) {
                setFieldError(input, text);
                ok = false;
                if (!firstInvalid) firstInvalid = input;
            }

            [[name, 'nameInvalid'], [lastname, 'lastnameInvalid']].forEach(function (pair) {
                var v = pair[0].value.trim();
                if (!v) fail(pair[0], t('required'));
                else if (!isName(v)) fail(pair[0], t(pair[1]));
                else setFieldError(pair[0], '');
            });

            var c = contact.value.trim();
            if (!c) fail(contact, t('required'));
            else if (!isEmail(c) && !isPhone(c)) fail(contact, t('contactInvalid'));
            else setFieldError(contact, '');

            service.value ? setFieldError(service, '') : fail(service, t('serviceRequired'));
            message.value.trim() ? setFieldError(message, '') : fail(message, t('required'));

            if (firstInvalid) firstInvalid.focus();
            return ok;
        }

        // Al corregir un campo, se le saca el error enseguida
        form.addEventListener('input', function (e) {
            if (e.target.closest('.cf-field')) setFieldError(e.target, '');
        });

        /* ---------- envío ---------- */
        function collect() {
            var data = {
                nombre: form.elements['nombre'].value.trim(),
                apellido: form.elements['apellido'].value.trim(),
                contacto: form.elements['contacto'].value.trim(),
                servicio: form.elements['servicio'].value,
                mensaje: form.elements['mensaje'].value.trim(),
                idioma: lang()
            };
            return data;
        }

        function sendViaMailto(data) {
            var subject = 'Consulta desde la web — ' + data.servicio;
            var body = 'Nombre: ' + data.nombre + ' ' + data.apellido + '\n' +
                       'Contacto: ' + data.contacto + '\n' +
                       'Servicio de interés: ' + data.servicio + '\n\n' +
                       data.mensaje;
            window.location.href = 'mailto:' + cfg.email +
                '?subject=' + encodeURIComponent(subject) +
                '&body=' + encodeURIComponent(body);
            setStatus(t('mailtoOpened'), 'ok');
        }

        function sendViaService(data) {
            var payload = {
                nombre: data.nombre,
                apellido: data.apellido,
                contacto: data.contacto,
                servicio: data.servicio,
                mensaje: data.mensaje,
                idioma: data.idioma,
                // Campos que los servicios usan para el asunto y para poder
                // responderle directo a la persona si dejó un email
                _subject: 'Consulta desde la web — ' + data.servicio,
                subject: 'Consulta desde la web — ' + data.servicio,
                from_name: data.nombre + ' ' + data.apellido
            };
            if (isEmail(data.contacto)) payload.email = data.contacto;
            if (cfg.accessKey) payload.access_key = cfg.accessKey;

            // Si el servicio no responde en 20 s se corta, para que el botón no quede trabado
            var ctrl = window.AbortController ? new AbortController() : null;
            var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 20000);
            var opts = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(payload)
            };
            if (ctrl) opts.signal = ctrl.signal;
            return fetch(cfg.formEndpoint, opts).then(function (res) {
                clearTimeout(timer);
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res;
            }, function (err) { clearTimeout(timer); throw err; });
        }

        form.addEventListener('submit', function (e) {
            e.preventDefault();

            // Trampa anti-spam: si un robot completó el campo oculto, hacemos
            // como que salió todo bien, sin enviar nada.
            if (form.elements['website'].value) {
                overlay.classList.add('is-sent');
                return;
            }

            setStatus('');
            if (!validate()) return;

            var data = collect();
            if (window.mjvSound) window.mjvSound.click();

            // Sin servicio configurado: respaldo por programa de correo
            if (!cfg.formEndpoint) {
                sendViaMailto(data);
                return;
            }

            submitBtn.disabled = true;
            setStatus(t('sending'), 'info');

            sendViaService(data).then(function () {
                setStatus('');
                overlay.classList.add('is-sent');
                if (window.mjvSound) window.mjvSound.pop();
                // Aviso para las estadísticas (analytics.js): el mensaje salió bien
                document.dispatchEvent(new CustomEvent('mjvformsent'));
            }).catch(function () {
                setStatus(t('sendError'), 'error');
            }).then(function () {
                submitBtn.disabled = false;
            });
        });
    });
})();
