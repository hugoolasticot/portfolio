/* ============================================================
   DÉFILEMENT ET PILOTAGE DE LA SCÈNE
   ============================================================
   Ce fichier est un module ES chargé depuis un CDN. Il n'apporte
   que du décor : le défilement inertiel et l'objet 3D.

   Rien d'essentiel ne dépend de lui. Si le CDN est injoignable,
   si le module échoue, ou si le navigateur ne gère pas les
   modules, la page reste intégralement lisible et navigable —
   tout ce qui compte est dans interface.js, qui est un script
   classique sans aucune dépendance externe.

   Les versions sont figées : une mise à jour silencieuse d'une
   bibliothèque ne doit jamais pouvoir casser le site en
   production.
   ============================================================ */

import Lenis from 'https://cdn.jsdelivr.net/npm/lenis@1.1.14/+esm';
import { gsap } from 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/+esm';
import { ScrollTrigger } from 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/ScrollTrigger/+esm';

import { creerScene } from './scene-3d.js';

gsap.registerPlugin(ScrollTrigger);

const mouvementReduit =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------
   LA SCÈNE
   ------------------------------------------------------------
   creerScene renvoie null si WebGL est indisponible. Tout le
   reste du fichier tient compte de cette possibilité.
   ------------------------------------------------------------ */
const conteneurScene = document.querySelector('.scene-3d');
const scene = conteneurScene ? creerScene(conteneurScene) : null;

// Le changement de thème est annoncé par interface.js. La scène
// relit alors ses couleurs dans le CSS : aucune couleur n'est
// écrite en dur dans le JavaScript.
if (scene) {
    document.addEventListener('theme-change', () => scene.relireCouleurs());
}

/* ------------------------------------------------------------
   DÉFILEMENT INERTIEL
   ------------------------------------------------------------
   Lenis remplace le défilement par à-coups de la molette par un
   mouvement continu et amorti. C'est ce qui donne au site son
   rythme : sans lui, l'objet 3D avancerait cran par cran.

   Il est désactivé quand le visiteur a demandé moins
   d'animations — on repasse alors au défilement natif du
   navigateur, immédiat.
   ------------------------------------------------------------ */
let lenis = null;

if (!mouvementReduit) {
    lenis = new Lenis({
        // LISSAGE PAR POURSUITE, ET NON PAR DURÉE FIXE.
        //
        // Lenis propose deux modes. Le mode `duration` lance, à
        // chaque cran de molette, une animation d'une durée
        // imposée : la page continue de glisser après qu'on a
        // arrêté, et un nouveau cran relance l'animation depuis le
        // début au lieu de s'y ajouter. À 1,15 s, cela se ressentait
        // franchement comme de la latence — la page ne partait pas
        // quand on scrollait, et ne s'arrêtait pas quand on
        // s'arrêtait.
        //
        // Le mode `lerp` poursuit en continu la position visée :
        // le mouvement démarre dès le premier cran et s'éteint
        // presque aussitôt qu'on relâche. On garde le défilement
        // continu dont la scène 3D a besoin, sans la traîne.
        //
        // 0,12 par image : plus haut, on retombe sur le défilement
        // par à-coups du navigateur ; plus bas, la traîne revient.
        lerp: 0.12,

        // Sur écran tactile, le défilement natif est déjà inertiel
        // et géré par le système : le doubler donne une sensation
        // de flottement et coûte de la batterie pour rien.
        smoothWheel: true,
        syncTouch: false,
    });

    // Un seul horloge pour les deux bibliothèques. Faire tourner
    // Lenis sur sa propre boucle en plus de celle de GSAP
    // reviendrait à rendre la page deux fois par image.
    lenis.on('scroll', ScrollTrigger.update);

    gsap.ticker.add((temps) => {
        lenis.raf(temps * 1000);   // GSAP compte en secondes, Lenis en millisecondes
    });

    // GSAP lisse par défaut l'écart entre deux images. Ici c'est
    // Lenis qui s'en charge : le double lissage ferait déraper la
    // synchronisation.
    gsap.ticker.lagSmoothing(0);
}

/* ------------------------------------------------------------
   LE SCROLL PILOTE L'OBJET
   ------------------------------------------------------------
   Une seule progression, de 0 en haut de page à 1 en bas, passée
   telle quelle à la scène. C'est elle qui décide de la pose de
   l'objet et de la position de la caméra (voir le tableau POSES
   dans scene-3d.js).

   scrub: true — l'animation est attachée à la barre de
   défilement au lieu de se déclencher à un seuil. C'est ce qui
   fait la différence entre une vraie mise en scène et des blocs
   qui apparaissent : le visiteur pilote le mouvement, il ne le
   subit pas.
   ------------------------------------------------------------ */
const pageAccueil = document.querySelector('[data-scene="accueil"]');

// Les six sections, dans l'ordre des six poses de l'objet.
const SECTIONS = ['accueil', 'apropos', 'competences', 'projets', 'parcours', 'contact']
    .map((id) => document.getElementById(id))
    .filter(Boolean);

if (scene && pageAccueil && SECTIONS.length > 1) {
    // Centre vertical de chaque section, mesuré une fois.
    //
    // Une première version se contentait de la progression brute du
    // déclencheur, de 0 en haut de page à 1 en bas. Les poses se
    // retrouvaient alors réparties à intervalles réguliers, alors
    // que les sections, elles, n'ont pas du tout la même hauteur :
    // arriver sur « Parcours » tombait au milieu de la transition
    // prévue pour « Projets ». En repérant les sections, chaque
    // pose correspond réellement à la section qu'elle illustre.
    let centres = [];

    function mesurer() {
        centres = SECTIONS.map(
            (section) => section.offsetTop + section.offsetHeight / 2
        );
    }

    // On ne mesure qu'au chargement et aux rafraîchissements de
    // ScrollTrigger (redimensionnement, images chargées). Lire la
    // géométrie à chaque image forcerait le navigateur à recalculer
    // la mise en page en plein défilement.
    mesurer();
    ScrollTrigger.addEventListener('refresh', mesurer);

    function progression() {
        // Le repère est le milieu de l'écran : une section est
        // « atteinte » quand son centre passe au centre du viewport.
        const repere = window.scrollY + window.innerHeight * 0.5;
        const dernier = centres.length - 1;

        if (repere <= centres[0]) return 0;
        if (repere >= centres[dernier]) return 1;

        for (let i = 0; i < dernier; i++) {
            if (repere <= centres[i + 1]) {
                const portee = centres[i + 1] - centres[i];
                const t = portee > 0 ? (repere - centres[i]) / portee : 0;
                return (i + t) / dernier;
            }
        }

        return 1;
    }

    ScrollTrigger.create({
        trigger: document.body,
        start: 'top top',
        end: 'bottom bottom',

        // scrub : l'animation est attachée à la barre de défilement
        // au lieu de se déclencher à un seuil. C'est ce qui fait la
        // différence entre une mise en scène et des blocs qui
        // apparaissent — le visiteur pilote le mouvement.
        scrub: true,
        onUpdate: () => scene.setProgression(progression()),
    });

    // Position de départ : on peut arriver sur la page avec une
    // ancre, ou après un rechargement en milieu de page.
    scene.setProgression(progression());
}

/* ------------------------------------------------------------
   LES FICHES PROJET
   ------------------------------------------------------------
   Elles ne chargent pas ce fichier du tout : l'objet 3D appartient
   à la page d'accueil et n'aurait rien à raconter sur une fiche.

   Or importer scene-3d.js télécharge Three.js, soit 166 Ko, même
   quand aucune scène n'est créée. Servir ce poids sur sept pages
   qui n'en font rien serait absurde. Les fiches se contentent donc
   de interface.js, et de la molette du navigateur.
   ------------------------------------------------------------ */

/* ------------------------------------------------------------
   ANCRES INTERNES
   ------------------------------------------------------------
   Lenis intercepte le défilement : les liens d'ancre du
   navigateur ne fonctionneraient plus sans cette passerelle.
   ------------------------------------------------------------ */
if (lenis) {
    document.querySelectorAll('a[href^="#"]').forEach((lien) => {
        lien.addEventListener('click', (evenement) => {
            const cible = lien.getAttribute('href');
            if (!cible || cible === '#') return;

            const element = document.querySelector(cible);
            if (!element) return;

            evenement.preventDefault();

            // offset négatif : la section ne doit pas se coller
            // sous l'en-tête fixe.
            lenis.scrollTo(element, { offset: -80 });

            // On déplace aussi le focus du clavier, sinon la
            // navigation au clavier resterait en haut de page
            // alors que l'écran a bougé.
            element.setAttribute('tabindex', '-1');
            element.focus({ preventScroll: true });
        });
    });
}

/* ------------------------------------------------------------
   RETOUR EN HAUT
   ------------------------------------------------------------
   interface.js gère déjà ce bouton avec window.scrollTo. Quand
   Lenis est actif, il faut passer par lui pour que l'objet 3D
   suive le mouvement au lieu de sauter.
   ------------------------------------------------------------ */
const boutonHaut = document.querySelector('.vers-haut');

if (lenis && boutonHaut) {
    boutonHaut.addEventListener(
        'click',
        (evenement) => {
            evenement.stopImmediatePropagation();
            lenis.scrollTo(0);
        },
        true   // en phase de capture, pour passer avant interface.js
    );
}
