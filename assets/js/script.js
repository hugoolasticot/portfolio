(function () {
    var layout = document.querySelector('.layout');
    var lastTrigger = null;

    function currentPopup() {
        var hash = location.hash.slice(1);
        if (!hash) return null;
        var el = document.getElementById(hash);
        return (el && el.classList.contains('popup-overlay')) ? el : null;
    }

    function openPopup(popup) {
        if (layout) layout.setAttribute('inert', '');
        document.body.classList.add('popup-open');

        popup.setAttribute('role', 'dialog');
        popup.setAttribute('aria-modal', 'true');

        var h1 = popup.querySelector('.popup-h1');
        if (h1) {
            if (!h1.id) h1.id = popup.id + '-title';
            popup.setAttribute('aria-labelledby', h1.id);
        }

        var box = popup.querySelector('.popup-box');
        if (box) {
            box.setAttribute('tabindex', '-1');
            box.focus();
        }
    }

    function closePopup(popup) {
        if (layout) layout.removeAttribute('inert');
        document.body.classList.remove('popup-open');
        if (lastTrigger && document.contains(lastTrigger)) {
            lastTrigger.focus();
        }
    }

    function sync() {
        var open = currentPopup();
        document.querySelectorAll('.popup-overlay').forEach(function (popup) {
            if (popup !== open) closePopup(popup);
        });
        if (open) openPopup(open);
    }

    document.querySelectorAll('.pcard').forEach(function (card) {
        card.addEventListener('click', function () {
            lastTrigger = card;
        });
    });

    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        var open = currentPopup();
        if (!open) return;
        var back = open.querySelector('.popup-back');
        if (back) back.click();
    });

    window.addEventListener('hashchange', sync);
    sync();


    /* ============================================================
       BASCULE DE THÈME CLAIR / SOMBRE
       Le thème initial est déjà posé par le script inline du <head>.
       Ici on ne gère que le clic et la mémorisation.
       ============================================================ */
    var boutonTheme = document.querySelector('.theme-toggle');

    if (boutonTheme) {
        boutonTheme.addEventListener('click', function () {
            var actuel = document.documentElement.getAttribute('data-theme');
            var nouveau = (actuel === 'light') ? 'dark' : 'light';

            document.documentElement.setAttribute('data-theme', nouveau);
            try {
                localStorage.setItem('theme', nouveau);
            } catch (e) {
                // Stockage indisponible : le thème reste valable pour la visite
            }
        });
    }


    /* ============================================================
       MENU MOBILE (burger)
       ============================================================ */
    var burger = document.querySelector('.nav-toggle');
    var sidebar = document.querySelector('.sidebar');

    if (burger && sidebar) {
        burger.addEventListener('click', function () {
            var ouvert = sidebar.classList.toggle('is-open');
            burger.setAttribute('aria-expanded', ouvert ? 'true' : 'false');
            burger.setAttribute('aria-label', ouvert ? 'Fermer le menu' : 'Ouvrir le menu');
        });

        // On referme le menu après avoir cliqué un lien
        sidebar.querySelectorAll('.sidebar-nav a').forEach(function (lien) {
            lien.addEventListener('click', function () {
                sidebar.classList.remove('is-open');
                burger.setAttribute('aria-expanded', 'false');
                burger.setAttribute('aria-label', 'Ouvrir le menu');
            });
        });
    }


    /* ============================================================
       BOUTON RETOUR EN HAUT
       ============================================================ */
    var boutonHaut = document.querySelector('.to-top');

    // Le visiteur peut avoir demandé moins d'animations dans son système
    var mouvementReduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (boutonHaut) {
        boutonHaut.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: mouvementReduit ? 'auto' : 'smooth' });
        });
    }


    /* ============================================================
       COPIE DE L'ADRESSE EMAIL
       ============================================================ */
    var boutonCopie = document.querySelector('.contact-copy');

    if (boutonCopie) {
        boutonCopie.addEventListener('click', function () {
            var email = boutonCopie.dataset.email;
            var label = boutonCopie.querySelector('.contact-copy-label');
            var texteInitial = label.textContent;

            navigator.clipboard.writeText(email).then(function () {
                label.textContent = 'Adresse copiée !';
                boutonCopie.classList.add('is-copied');

                // On remet le libellé d'origine au bout de 2 secondes
                setTimeout(function () {
                    label.textContent = texteInitial;
                    boutonCopie.classList.remove('is-copied');
                }, 2000);
            }).catch(function () {
                // Presse-papier refusé : on affiche l'adresse pour la copie manuelle
                label.textContent = email;
            });
        });
    }


    /* ============================================================
       BARRE LATÉRALE : densité au scroll + lien de la section active
       ============================================================ */
    var liensNav = document.querySelectorAll('.sidebar-nav a');
    var sections = [];

    // On récupère la section visée par chaque lien
    liensNav.forEach(function (lien) {
        var cible = document.querySelector(lien.getAttribute('href'));
        if (cible) sections.push({ lien: lien, section: cible });
    });

    function auScroll() {
        var y = window.scrollY;

        // La barre se densifie dès qu'on quitte le haut de page
        if (sidebar) sidebar.classList.toggle('is-scrolled', y > 40);
        if (boutonHaut) boutonHaut.classList.toggle('is-visible', y > 500);

        // Scrollspy : la section active est la dernière dont le haut est passé
        var active = null;
        sections.forEach(function (item) {
            if (item.section.offsetTop <= y + 120) active = item.lien;
        });

        liensNav.forEach(function (lien) {
            lien.classList.toggle('is-active', lien === active);
        });
    }

    window.addEventListener('scroll', auScroll, { passive: true });
    auScroll();


    /* ============================================================
       APPARITION AU SCROLL
       ============================================================ */
    var aAnimer = [];

    // colonnes = nombre d'éléments par ligne, pour repartir de zéro
    // à chaque nouvelle ligne et obtenir une vraie cascade
    function preparerGroupe(selecteur, colonnes) {
        document.querySelectorAll(selecteur).forEach(function (el, i) {
            el.classList.add('reveal');
            el.style.transitionDelay = ((i % colonnes) * 70) + 'ms';
            aAnimer.push(el);
        });
    }

    preparerGroupe('.sec-label', 1);
    preparerGroupe('.apropos-big', 1);
    preparerGroupe('.contact-big', 1);
    preparerGroupe('.projects-grid .pcard', 3);
    preparerGroupe('.skills-grid .skill-item', 4);

    if ('IntersectionObserver' in window) {
        var observateur = new IntersectionObserver(function (entrees) {
            entrees.forEach(function (entree) {
                if (!entree.isIntersecting) return;

                entree.target.classList.add('is-visible');

                // Une fois l'élément apparu, on enlève le décalage :
                // sinon il ralentirait aussi l'animation de survol
                setTimeout(function () {
                    entree.target.style.transitionDelay = '';
                }, 700);

                // L'apparition ne se joue qu'une fois
                observateur.unobserve(entree.target);
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

        aAnimer.forEach(function (el) { observateur.observe(el); });
    } else {
        // Navigateur sans IntersectionObserver : on affiche tout directement
        aAnimer.forEach(function (el) { el.classList.add('is-visible'); });
    }


    /* ============================================================
       FILTRE DES PROJETS
       Les boutons radio restent la source de vérité (CSS pur en repli).
       Le JS ne sert qu'à animer la disparition avant le display:none.
       ============================================================ */
    var cartes = document.querySelectorAll('.projects-grid .pcard');
    var minuteurs = [];

    function appliquerFiltre() {
        var coche = document.querySelector('.filter-radios:checked');
        if (!coche) return;

        // "pf-python" donne "python", "pf-all" donne "all"
        var categorie = coche.id.replace('pf-', '');

        cartes.forEach(function (carte, i) {
            var garder = (categorie === 'all') || carte.classList.contains(categorie);

            clearTimeout(minuteurs[i]);

            if (garder) {
                carte.classList.remove('is-hidden');

                // On force le navigateur à recalculer la position avant
                // de lancer le fondu, sinon il passe directement à l'état final
                void carte.offsetWidth;

                carte.classList.remove('is-hiding');
            } else {
                carte.classList.add('is-hiding');

                // On attend la fin du fondu pour retirer la carte de la grille
                minuteurs[i] = setTimeout(function () {
                    carte.classList.add('is-hidden');
                }, 220);
            }
        });
    }

    document.querySelectorAll('.filter-radios').forEach(function (radio) {
        radio.addEventListener('change', appliquerFiltre);
    });

    // Au chargement : le navigateur peut avoir restauré un filtre coché
    appliquerFiltre();
})();
