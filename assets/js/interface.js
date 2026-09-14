/* ============================================================
   INTERFACE
   ============================================================
   Script classique, sans dépendance ni module : il se charge et
   s'exécute même si le CDN qui héberge Three.js et GSAP est
   injoignable. Tout ce qui est nécessaire à l'usage du site est
   donc ici, et rien d'essentiel n'est dans scroll.js.

   Chaque bloc vérifie que l'élément qu'il pilote existe avant de
   s'exécuter : les fiches projet, qui n'ont ni grille de projets
   ni navigation de section, utilisent le même fichier sans
   déclencher la moindre erreur.
   ============================================================ */
(function () {
    'use strict';

    var racine = document.documentElement;

    /* ========================================================
       THÈME CLAIR / SOMBRE
       ========================================================
       Le thème initial est déjà posé par le script en ligne du
       <head>, avant le premier affichage. Ici on ne gère que le
       clic et la mémorisation.
       ======================================================== */
    var boutonTheme = document.querySelector('.bascule-theme');

    if (boutonTheme) {
        boutonTheme.addEventListener('click', function () {
            var actuel = racine.getAttribute('data-theme');
            var nouveau = actuel === 'dark' ? 'light' : 'dark';

            racine.setAttribute('data-theme', nouveau);

            try {
                localStorage.setItem('theme', nouveau);
            } catch (e) {
                // Stockage bloqué (navigation privée) : le choix
                // reste valable pour la durée de la visite.
            }

            // La scène 3D relit ses couleurs dans le CSS. On passe
            // par un événement plutôt que par un appel direct pour
            // que ce fichier n'ait aucune connaissance de la 3D.
            document.dispatchEvent(new CustomEvent('theme-change'));
        });
    }

    /* ========================================================
       MENU EN PETIT ÉCRAN
       ======================================================== */
    var boutonMenu = document.querySelector('.menu-bascule');
    var navigation = document.querySelector('.nav-principale');

    if (boutonMenu && navigation) {
        var basculerMenu = function (ouvrir) {
            navigation.classList.toggle('est-ouverte', ouvrir);
            boutonMenu.setAttribute('aria-expanded', ouvrir ? 'true' : 'false');
            boutonMenu.setAttribute(
                'aria-label',
                ouvrir ? 'Fermer le menu' : 'Ouvrir le menu'
            );

            // Replié, le menu ne doit pas être atteignable au
            // clavier. `inert` retire l'élément et tout son
            // contenu du parcours de tabulation ; les navigateurs
            // qui ne le connaissent pas l'ignorent simplement, et
            // pointer-events suffit alors à la souris.
            if ('inert' in HTMLElement.prototype) {
                navigation.inert = !ouvrir && estPetitEcran();
            }
        };

        var estPetitEcran = function () {
            return window.matchMedia('(max-width: 759px)').matches;
        };

        boutonMenu.addEventListener('click', function () {
            basculerMenu(!navigation.classList.contains('est-ouverte'));
        });

        // On referme après un clic sur un lien.
        navigation.addEventListener('click', function (evenement) {
            if (evenement.target.closest('a')) basculerMenu(false);
        });

        // Échap referme, et rend le focus au bouton.
        document.addEventListener('keydown', function (evenement) {
            if (evenement.key !== 'Escape') return;
            if (!navigation.classList.contains('est-ouverte')) return;
            basculerMenu(false);
            boutonMenu.focus();
        });

        // En repassant en grand écran, le menu redevient une barre
        // toujours visible : il ne doit plus être inerte.
        window.addEventListener('resize', function () {
            if (!estPetitEcran()) {
                navigation.classList.remove('est-ouverte');
                if ('inert' in HTMLElement.prototype) navigation.inert = false;
                boutonMenu.setAttribute('aria-expanded', 'false');
            }
        });

        basculerMenu(false);
    }

    /* ========================================================
       EN-TÊTE ET BOUTON DE RETOUR EN HAUT
       ========================================================
       Une seule écoute du défilement pour les deux, et le travail
       est repoussé à la prochaine image via requestAnimationFrame.
       L'événement scroll peut se déclencher des dizaines de fois
       entre deux images : sans ce garde-fou, on ferait le même
       calcul plusieurs fois pour un seul affichage.
       ======================================================== */
    var entete = document.querySelector('.entete');
    var boutonHaut = document.querySelector('.vers-haut');
    var imagePrevue = false;

    function surDefilement() {
        imagePrevue = false;
        var y = window.scrollY;

        if (entete) entete.classList.toggle('est-detachee', y > 24);
        if (boutonHaut) boutonHaut.classList.toggle('est-visible', y > 600);
    }

    if (entete || boutonHaut) {
        window.addEventListener(
            'scroll',
            function () {
                if (imagePrevue) return;
                imagePrevue = true;
                requestAnimationFrame(surDefilement);
            },
            { passive: true }
        );

        surDefilement();
    }

    if (boutonHaut) {
        boutonHaut.addEventListener('click', function () {
            var reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            window.scrollTo({ top: 0, behavior: reduit ? 'auto' : 'smooth' });
        });
    }

    /* ========================================================
       LIEN DE LA SECTION EN COURS
       ========================================================
       L'ancienne version lisait `section.offsetTop` à chaque
       événement de défilement. Cette lecture force le navigateur
       à recalculer toute la mise en page avant de répondre, ce
       qui est la première cause de saccades sur une page longue.

       IntersectionObserver fait le même travail sans jamais
       interroger la géométrie : c'est le navigateur qui prévient
       quand une section entre ou sort du cadre.
       ======================================================== */
    var liensNav = document.querySelectorAll('.nav-principale a[href^="#"]');

    if (liensNav.length && 'IntersectionObserver' in window) {
        var parId = {};
        var sections = [];

        liensNav.forEach(function (lien) {
            var id = lien.getAttribute('href').slice(1);
            var section = document.getElementById(id);
            if (!section) return;
            parId[id] = lien;
            sections.push(section);
        });

        // Les sections visibles à cet instant, dans l'ordre du
        // document. On met en avant la première : c'est celle que
        // le visiteur est en train de lire.
        var visibles = new Set();

        var observateurSections = new IntersectionObserver(
            function (entrees) {
                entrees.forEach(function (entree) {
                    if (entree.isIntersecting) visibles.add(entree.target.id);
                    else visibles.delete(entree.target.id);
                });

                var active = null;
                sections.forEach(function (section) {
                    if (active === null && visibles.has(section.id)) {
                        active = section.id;
                    }
                });

                Object.keys(parId).forEach(function (id) {
                    parId[id].classList.toggle('est-active', id === active);
                    if (id === active) parId[id].setAttribute('aria-current', 'true');
                    else parId[id].removeAttribute('aria-current');
                });
            },
            {
                // La bande active est le tiers haut de l'écran :
                // une section compte comme « en cours » dès que son
                // titre est arrivé sous l'en-tête.
                rootMargin: '-15% 0px -60% 0px',
            }
        );

        sections.forEach(function (section) {
            observateurSections.observe(section);
        });
    }

    /* ========================================================
       RÉVÉLATIONS AU DÉFILEMENT
       ========================================================
       Les blocs apparaissent quand ils entrent dans le cadre.
       L'animation ne se joue qu'une fois : revoir un bloc
       réapparaître en remontant serait agaçant.
       ======================================================== */
    var aReveler = [];

    // colonnes : le décalage repart de zéro à chaque nouvelle
    // ligne, pour obtenir une cascade plutôt qu'un dégradé continu
    // qui ferait attendre le dernier élément.
    function preparer(selecteur, colonnes) {
        document.querySelectorAll(selecteur).forEach(function (element, i) {
            element.classList.add('reveler');
            element.style.transitionDelay = (i % colonnes) * 80 + 'ms';
            aReveler.push(element);
        });
    }

    preparer('.section-titre', 1);
    preparer('.a-reveler', 1);
    preparer('.groupe-competences', 3);
    preparer('.carte-projet', 2);
    preparer('.entree-frise', 1);
    preparer('.lien-contact', 1);

    if (aReveler.length && 'IntersectionObserver' in window) {
        var observateur = new IntersectionObserver(
            function (entrees) {
                entrees.forEach(function (entree) {
                    if (!entree.isIntersecting) return;

                    entree.target.classList.add('est-visible');

                    // Une fois le bloc apparu, on retire le
                    // décalage : sinon il ralentirait aussi les
                    // transitions de survol.
                    setTimeout(function () {
                        entree.target.style.transitionDelay = '';
                    }, 1000);

                    observateur.unobserve(entree.target);
                });
            },
            { threshold: 0.1, rootMargin: '0px 0px -8% 0px' }
        );

        aReveler.forEach(function (element) {
            observateur.observe(element);
        });
    } else {
        // Sans IntersectionObserver, on affiche tout d'emblée.
        aReveler.forEach(function (element) {
            element.classList.add('est-visible');
        });
    }

    /* ========================================================
       FILTRE DES PROJETS
       ========================================================
       Les boutons radio restent la source de vérité : le filtre
       fonctionne en CSS pur si le JavaScript ne se charge pas
       (voir composants.css). Le JavaScript n'ajoute qu'un fondu
       avant de retirer la carte de la grille.
       ======================================================== */
    var radios = document.querySelectorAll('.radios-filtre');
    var cartes = document.querySelectorAll('.grille-projets .carte-projet');
    var minuteurs = [];

    function appliquerFiltre() {
        var coche = document.querySelector('.radios-filtre:checked');
        if (!coche) return;

        // "f-python" donne "python", "f-tous" donne "tous".
        var categorie = coche.id.replace('f-', '');

        cartes.forEach(function (carte, i) {
            var garder = categorie === 'tous' || carte.classList.contains(categorie);

            clearTimeout(minuteurs[i]);

            if (garder) {
                carte.classList.remove('est-masquee');

                // Force le navigateur à prendre en compte le
                // retour dans la grille avant de lancer le fondu.
                // Sans cette lecture, il passe directement à
                // l'état final et le fondu ne se voit pas.
                void carte.offsetWidth;

                carte.classList.remove('est-sortante');
            } else {
                carte.classList.add('est-sortante');

                minuteurs[i] = setTimeout(function () {
                    carte.classList.add('est-masquee');
                }, 200);
            }
        });
    }

    if (radios.length && cartes.length) {
        radios.forEach(function (radio) {
            radio.addEventListener('change', appliquerFiltre);
        });

        // Au chargement : le navigateur peut avoir restauré un
        // filtre coché après un retour arrière.
        appliquerFiltre();
    }

    /* ========================================================
       COPIE DE L'ADRESSE EMAIL
       ======================================================== */
    var boutonCopie = document.querySelector('.copier-email');

    if (boutonCopie && navigator.clipboard) {
        boutonCopie.addEventListener('click', function () {
            var email = boutonCopie.dataset.email;
            var libelle = boutonCopie.querySelector('.libelle-copie');
            var texteInitial = libelle.textContent;

            navigator.clipboard
                .writeText(email)
                .then(function () {
                    // textContent et non innerHTML : on n'injecte
                    // jamais de balises à partir d'une donnée.
                    libelle.textContent = 'Adresse copiée';
                    boutonCopie.classList.add('est-copie');

                    setTimeout(function () {
                        libelle.textContent = texteInitial;
                        boutonCopie.classList.remove('est-copie');
                    }, 2200);
                })
                .catch(function () {
                    // Presse-papier refusé : on affiche l'adresse
                    // pour que le visiteur la copie à la main.
                    libelle.textContent = email;
                });
        });
    } else if (boutonCopie) {
        // Sans API presse-papier, le bouton ne sert à rien.
        boutonCopie.hidden = true;
    }
})();
