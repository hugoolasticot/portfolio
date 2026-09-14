/* ============================================================
   LA SCÈNE 3D
   ============================================================
   L'objet : une coque de verre fumé à facettes qui s'ouvre au fil
   du scroll, et qui laisse voir à l'intérieur un réseau de nœuds
   reliés par des arêtes — un graphe.

   Pourquoi cet objet : tous mes projets tournent autour de la même
   idée. Le parcours de graphe en BFS de Wall Is You, les automates
   d'Exploration Algorithmique, la topologie réseau du serveur DHCP,
   les schémas relationnels de Zarza-Ski et de CampusConnect : ce
   sont tous des nœuds reliés par des arêtes. Et la coque lisse
   qu'on traverse pour voir le mécanisme en dessous, c'est la
   traduction directe de « j'aime comprendre comment les choses
   fonctionnent ».

   Ce module n'expose qu'une fonction, creerScene(). Elle renvoie
   null si la 3D ne peut pas tourner — le site reste alors
   entièrement fonctionnel, simplement sans décor.
   ============================================================ */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js';

/* ------------------------------------------------------------
   LES SIX ÉTATS DE L'OBJET
   ------------------------------------------------------------
   Une pose par section du site. Le scroll ne fait rien d'autre
   que déplacer un curseur entre ces poses : GSAP fournit une
   progression de 0 à 1 sur toute la page, et la fonction
   poseInterpolee() en déduit la pose courante.

   camera    : position de la caméra (x, y, z)
   rotation  : orientation de l'objet, en tours (1 = 360°)
   ouverture : 0 la coque est fermée, 1 ses facettes sont écartées
   graphe    : opacité du réseau interne
   eveil     : proportion de nœuds allumés
   chaine    : 0 le graphe est une sphère, 1 il est aligné en ligne
   ------------------------------------------------------------ */
const POSES = [
    // 1. Accueil — l'objet est loin, fermé, presque immobile.
    { camera: [0.00,  0.00, 5.60], regard: [-1.30, 0.00, 0.00], rotation: [ 0.00,  0.00, 0.00], ouverture: 0.00, graphe: 0.06, eveil: 0.00, chaine: 0 },

    // 2. À propos — on se rapproche, la coque commence à respirer.
    { camera: [1.60,  0.50, 5.10], regard: [-0.55, 0.10, 0.00], rotation: [-0.04,  0.13, 0.01], ouverture: 0.16, graphe: 0.45, eveil: 0.15, chaine: 0 },

    // 3. Compétences — le réseau s'allume nœud par nœud.
    { camera: [-1.55, 0.35, 5.00], regard: [ 0.75, 0.05, 0.00], rotation: [ 0.05,  0.31, -0.02], ouverture: 0.34, graphe: 1.00, eveil: 1.00, chaine: 0 },

    // 4. Projets — la coque s'écarte franchement et libère le graphe.
    { camera: [0.75, -0.95, 4.80], regard: [-0.45,-0.10, 0.00], rotation: [ 0.09,  0.52, 0.03], ouverture: 1.00, graphe: 1.00, eveil: 1.00, chaine: 0 },

    // 5. Parcours — le graphe s'aligne : il devient une ligne de temps.
    { camera: [0.00,  0.10, 4.80], regard: [-1.15, 0.15, 0.00], rotation: [ 0.02,  0.70, 0.00], ouverture: 0.70, graphe: 0.90, eveil: 0.85, chaine: 1 },

    // 6. Contact — tout se recompose et s'éloigne.
    { camera: [0.00,  0.25, 6.40], regard: [-0.90, 0.00, 0.00], rotation: [ 0.00,  0.88, 0.00], ouverture: 0.08, graphe: 0.18, eveil: 0.10, chaine: 0 },
];

/* ============================================================
   SHADER DE LA COQUE
   ============================================================
   J'écris ce matériau à la main plutôt que d'utiliser l'option
   `transmission` de Three.js. La transmission réelle oblige le
   moteur à rendre toute la scène une deuxième fois dans une
   texture à chaque image, pour que l'objet puisse échantillonner
   ce qu'il y a derrière lui. C'est le poste le plus lourd de la
   bibliothèque, et le budget est de 60 fps sur un portable
   milieu de gamme.

   Ce shader donne le même registre — réfraction, irisation,
   bords qui accrochent la lumière — pour une fraction du coût,
   et chacun de ses paramètres peut être animé au scroll.
   ============================================================ */

const SHADER_SOMMET = /* glsl */ `
    // Centroïde de la facette à laquelle appartient ce sommet.
    // Calculé une fois en JavaScript, il donne à chaque facette
    // sa propre direction d'éclatement.
    attribute vec3 aCentre;
    attribute vec3 aBary;     // coordonnées barycentriques du sommet

    uniform float uOuverture;   // 0 fermé → 1 éclaté
    uniform float uTemps;       // secondes écoulées, pour la respiration

    varying vec3 vNormale;      // normale exprimée dans le repère du monde
    varying vec3 vVersCamera;   // direction sommet → caméra
    varying float vEcart;       // de combien cette facette s'est écartée
    varying vec3 vBary;         // interpolé : distance aux trois côtés

    void main() {
        // L'éclatement : chaque facette part le long de l'axe qui
        // relie le centre de l'objet à son propre centre. Les
        // facettes les plus éloignées partent un peu plus loin,
        // ce qui évite un écartement parfaitement uniforme qui
        // aurait l'air mécanique.
        vec3 axe = normalize(aCentre);
        float distance = uOuverture * (0.30 + length(aCentre) * 0.34);
        vec3 pos = position + axe * distance;

        // Respiration : une oscillation très lente et très faible,
        // décalée d'une facette à l'autre. Elle empêche l'objet de
        // paraître figé quand on ne scrolle pas, sans jamais
        // attirer l'œil.
        pos += normal * sin(uTemps * 0.55 + aCentre.x * 4.0 + aCentre.y * 2.0) * 0.007;

        vec4 posMonde = modelMatrix * vec4(pos, 1.0);

        vNormale = normalize(mat3(modelMatrix) * normal);
        vVersCamera = normalize(cameraPosition - posMonde.xyz);
        vEcart = distance;
        vBary = aBary;

        gl_Position = projectionMatrix * viewMatrix * posMonde;
    }
`;

const SHADER_FRAGMENT = /* glsl */ `
    uniform vec3  uVerre;     // teinte de fond du verre
    uniform vec3  uIrisA;     // premier extrême de l'irisation
    uniform vec3  uIrisB;     // second extrême
    uniform float uOpacite;   // opacité générale, pilotée au scroll
    uniform float uTemps;

    varying vec3 vNormale;
    varying vec3 vVersCamera;
    varying float vEcart;
    varying vec3 vBary;

    void main() {
        // FRESNEL — la loi qui fait qu'une vitre est transparente
        // quand on la regarde de face et miroir quand on la regarde
        // en biais. On mesure l'angle entre la normale de la surface
        // et la direction du regard : proche de 0 en biais, proche
        // de 1 de face.
        //
        // L'exposant décide de la largeur du liseré lumineux sur
        // le pourtour. Plus il est élevé, plus le liseré est fin et
        // plus le centre de l'objet reste transparent — donc plus
        // le texte posé par-dessus reste lisible.
        float face = abs(dot(vNormale, vVersCamera));
        float fresnel = pow(1.0 - face, 3.2);

        // IRISATION — l'arc-en-ciel qu'on voit sur une bulle de
        // savon ou une flaque d'essence. Il vient de l'épaisseur
        // du film, qui fait que certaines longueurs d'onde
        // s'annulent et d'autres s'additionnent. On l'approche ici
        // en faisant varier le mélange des deux teintes selon
        // l'angle de vue et selon l'orientation de la facette :
        // la couleur change donc quand l'objet tourne, ce qui est
        // exactement l'effet recherché.
        float phase = fract(fresnel * 2.1
                          + dot(vNormale, vec3(0.31, 0.68, 0.22)) * 0.6
                          + uTemps * 0.012);
        vec3 iris = mix(uIrisA, uIrisB, smoothstep(0.0, 1.0, phase));

        // ARÊTES DES FACETTES — ce qui fait lire « verre taillé »
        // plutôt que « bulle de savon ».
        //
        // vBary vaut 0 sur un côté de la facette et 1 au sommet
        // opposé : le plus petit des trois composants est donc la
        // distance au côté le plus proche. fwidth() donne de combien
        // cette valeur change d'un pixel au suivant, ce qui permet
        // de tracer un trait d'épaisseur constante à l'écran quelle
        // que soit la distance de la facette à la caméra.
        vec3 largeur = fwidth(vBary);
        vec3 lisse = smoothstep(vec3(0.0), largeur * 1.6, vBary);
        float arete = 1.0 - min(min(lisse.x, lisse.y), lisse.z);

        vec3 couleur = mix(uVerre, iris, fresnel * 0.92);

        // L'arête prend la couleur d'irisation à pleine intensité.
        couleur = mix(couleur, iris, arete * 0.85);

        // Les facettes qui se sont le plus écartées captent un peu
        // plus de lumière, une fois sorties de l'ombre de l'objet.
        couleur = mix(couleur, iris, clamp(vEcart * 0.5, 0.0, 0.35));

        // L'opacité suit presque entièrement le fresnel : de face
        // le verre est quasiment invisible, et seule la silhouette
        // accroche la lumière.
        //
        // C'est ce qui rend le texte lisible par-dessus l'objet.
        // Une version antérieure remplissait la forme entière et
        // le contenu passait devant un aplat lumineux : illisible.
        //
        // Le terme constant est le voile du verre fumé : il donne
        // sa masse à l'objet. Il reste volontairement sous 6 %,
        // de quoi teinter le fond sans faire bouger le contraste
        // du texte posé par-dessus.
        float alpha = uOpacite * (0.055 + fresnel * 0.88 + arete * 0.55);

        gl_FragColor = vec4(couleur, alpha);

        // Convertit la couleur de l'espace linéaire (dans lequel
        // les calculs ci-dessus sont justes) vers le sRGB attendu
        // par l'écran. Sans cette ligne, tout paraît délavé.
        #include <colorspace_fragment>
    }
`;

/* ============================================================
   OUTILS DE GÉOMÉTRIE
   ============================================================ */

/**
 * Répartit n points sur une sphère selon la suite de Fibonacci.
 * Placer des points « au hasard » sur une sphère donne toujours des
 * paquets et des trous ; l'angle d'or, lui, les écarte de façon
 * régulière sans jamais créer d'alignement visible.
 */
function pointsSurSphere(nombre, rayon) {
    const points = [];
    const angleOr = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < nombre; i++) {
        const y = 1 - (i / (nombre - 1)) * 2;   // de +1 à -1
        const rayonTranche = Math.sqrt(Math.max(0, 1 - y * y));
        const theta = angleOr * i;

        points.push(new THREE.Vector3(
            Math.cos(theta) * rayonTranche * rayon,
            y * rayon,
            Math.sin(theta) * rayonTranche * rayon
        ));
    }

    return points;
}

/**
 * Relie chaque nœud à ses k plus proches voisins.
 * Le résultat est un vrai graphe : un maillage irrégulier, dense
 * par endroits, plus lâche ailleurs — pas une grille.
 *
 * Les paires sont dédupliquées via une clé « petit-grand », sinon
 * chaque arête serait tracée deux fois.
 */
function relierVoisins(points, k) {
    const aretes = [];
    const vues = new Set();

    points.forEach((point, i) => {
        const distances = points
            .map((autre, j) => ({ j, d: point.distanceToSquared(autre) }))
            .filter((entree) => entree.j !== i)
            .sort((a, b) => a.d - b.d)
            .slice(0, k);

        distances.forEach(({ j }) => {
            const cle = i < j ? `${i}-${j}` : `${j}-${i}`;
            if (vues.has(cle)) return;
            vues.add(cle);
            aretes.push([i, j]);
        });
    });

    return aretes;
}

/**
 * Positions de la disposition « chaîne » : les mêmes nœuds alignés
 * sur un axe, avec une ondulation douce. C'est la forme que prend
 * le graphe sur la section Parcours — un graphe qui se déplie en
 * ligne de temps.
 */
function pointsEnChaine(nombre, longueur) {
    const points = [];

    for (let i = 0; i < nombre; i++) {
        const t = nombre === 1 ? 0.5 : i / (nombre - 1);
        points.push(new THREE.Vector3(
            (t - 0.5) * longueur,
            Math.sin(t * Math.PI * 3.2) * 0.14,
            Math.cos(t * Math.PI * 2.4) * 0.10
        ));
    }

    return points;
}

/**
 * Ajoute à une géométrie un attribut aCentre : pour chaque sommet,
 * le centre de la facette à laquelle il appartient. C'est lui qui
 * permet au shader d'écarter les facettes une à une.
 *
 * La géométrie doit être « non indexée » : chaque facette possède
 * alors ses trois sommets en propre, et on peut les déplacer sans
 * déchirer les facettes voisines.
 */
function ajouterCentresDeFacette(geometrie) {
    const positions = geometrie.attributes.position.array;
    const centres = new Float32Array(positions.length);
    const barycentres = new Float32Array(positions.length);

    for (let i = 0; i < positions.length; i += 9) {
        const cx = (positions[i]     + positions[i + 3] + positions[i + 6]) / 3;
        const cy = (positions[i + 1] + positions[i + 4] + positions[i + 7]) / 3;
        const cz = (positions[i + 2] + positions[i + 5] + positions[i + 8]) / 3;

        // Les trois sommets de la facette reçoivent le même centre.
        for (let s = 0; s < 3; s++) {
            centres[i + s * 3]     = cx;
            centres[i + s * 3 + 1] = cy;
            centres[i + s * 3 + 2] = cz;
        }

        // Coordonnées barycentriques : (1,0,0), (0,1,0), (0,0,1)
        // pour les trois sommets. Interpolées sur la facette, elles
        // donnent en chaque point sa distance relative à chacun des
        // trois côtés — ce qui permet au shader de dessiner les
        // arêtes du polyèdre sans aucune géométrie supplémentaire.
        barycentres[i]     = 1; barycentres[i + 1] = 0; barycentres[i + 2] = 0;
        barycentres[i + 3] = 0; barycentres[i + 4] = 1; barycentres[i + 5] = 0;
        barycentres[i + 6] = 0; barycentres[i + 7] = 0; barycentres[i + 8] = 1;
    }

    geometrie.setAttribute('aCentre', new THREE.BufferAttribute(centres, 3));
    geometrie.setAttribute('aBary', new THREE.BufferAttribute(barycentres, 3));
}

/* ============================================================
   INTERPOLATIONS
   ============================================================ */

/** Adoucit une progression linéaire : départ et arrivée ralentis. */
function adoucir(t) {
    return t * t * (3 - 2 * t);
}

/**
 * Donne la pose correspondant à une progression globale de 0 à 1.
 * On repère entre quelles deux poses on se trouve, puis on
 * interpole entre elles.
 */
function poseInterpolee(progression) {
    const dernier = POSES.length - 1;
    const position = Math.max(0, Math.min(1, progression)) * dernier;

    const indice = Math.min(Math.floor(position), dernier - 1);
    const t = adoucir(position - indice);

    const a = POSES[indice];
    const b = POSES[indice + 1];
    const entre = (x, y) => x + (y - x) * t;

    return {
        camera: [
            entre(a.camera[0], b.camera[0]),
            entre(a.camera[1], b.camera[1]),
            entre(a.camera[2], b.camera[2]),
        ],
        regard: [
            entre(a.regard[0], b.regard[0]),
            entre(a.regard[1], b.regard[1]),
            entre(a.regard[2], b.regard[2]),
        ],
        rotation: [
            entre(a.rotation[0], b.rotation[0]),
            entre(a.rotation[1], b.rotation[1]),
            entre(a.rotation[2], b.rotation[2]),
        ],
        ouverture: entre(a.ouverture, b.ouverture),
        graphe:    entre(a.graphe,    b.graphe),
        eveil:     entre(a.eveil,     b.eveil),
        chaine:    entre(a.chaine,    b.chaine),
    };
}

/**
 * Amortissement exponentiel, indépendant du nombre d'images par
 * seconde. Sans la correction par delta, l'objet serait deux fois
 * plus nerveux sur un écran 120 Hz que sur un écran 60 Hz.
 */
function amortir(actuel, cible, vitesse, delta) {
    return actuel + (cible - actuel) * (1 - Math.exp(-vitesse * delta));
}

/** Lit une couleur définie en CSS, pour que le CSS reste la seule
 *  source de vérité des couleurs du site. */
function couleurCss(nom, styles) {
    return new THREE.Color(styles.getPropertyValue(nom).trim() || '#888888');
}

/* ============================================================
   CONSTRUCTION DE LA SCÈNE
   ============================================================ */

export function creerScene(conteneur) {
    // --------------------------------------------------------
    // Garde-fous — chacun renvoie null, et le site s'en passe.
    // --------------------------------------------------------
    if (!conteneur) return null;

    const mouvementReduit =
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const petitEcran = window.innerWidth < 760;

    let rendu;
    try {
        rendu = new THREE.WebGLRenderer({
            antialias: !petitEcran,   // coûteux, et peu visible sur un écran dense
            alpha: true,              // le fond reste celui de la page
            powerPreference: 'high-performance',
        });
    } catch (erreur) {
        // WebGL indisponible (pilote, machine virtuelle, réglage
        // du navigateur). On abandonne la 3D sans bruit.
        return null;
    }

    if (!rendu.getContext()) return null;

    // --------------------------------------------------------
    // Budget : tout ce qui coûte est réduit sur petit écran.
    // --------------------------------------------------------
    const NB_NOEUDS  = petitEcran ? 26 : 48;
    const DETAIL     = petitEcran ? 1  : 2;    // subdivisions de la coque
    const DPR_MAX    = petitEcran ? 1.5 : 2;
    const VOISINS    = 3;

    rendu.setPixelRatio(Math.min(window.devicePixelRatio, DPR_MAX));
    rendu.setSize(conteneur.clientWidth, conteneur.clientHeight);
    rendu.outputColorSpace = THREE.SRGBColorSpace;
    conteneur.appendChild(rendu.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
        38,
        conteneur.clientWidth / conteneur.clientHeight,
        0.1,
        100
    );
    camera.position.set(0, 0, 3.6);

    // Le groupe porte l'objet entier : on le fait tourner d'un
    // bloc, coque et graphe ensemble.
    const objet = new THREE.Group();
    scene.add(objet);

    // --------------------------------------------------------
    // LA COQUE
    // --------------------------------------------------------
    // IcosahedronGeometry est déjà non indexée : chaque facette
    // possède ses trois sommets en propre, ce qui est exactement ce
    // qu'il faut pour les écarter une à une sans les déchirer.
    const geoCoque = new THREE.IcosahedronGeometry(1, DETAIL);
    ajouterCentresDeFacette(geoCoque);

    const styles = getComputedStyle(document.documentElement);

    const uniformes = {
        uOuverture: { value: 0 },
        uTemps:     { value: 0 },
        uOpacite:   { value: 1 },
        uVerre:     { value: couleurCss('--verre',  styles) },
        uIrisA:     { value: couleurCss('--iris-a', styles) },
        uIrisB:     { value: couleurCss('--iris-b', styles) },
    };

    const coque = new THREE.Mesh(
        geoCoque,
        new THREE.ShaderMaterial({
            vertexShader: SHADER_SOMMET,
            fragmentShader: SHADER_FRAGMENT,
            uniforms: uniformes,
            transparent: true,

            // Une seule face dessinée. En DoubleSide, chaque rayon
            // traversait deux couches de coque et leurs opacités
            // s'additionnaient jusqu'à remplir la silhouette d'un
            // aplat opaque.
            side: THREE.FrontSide,

            // Sans écriture dans le tampon de profondeur, les
            // facettes transparentes se mélangent correctement
            // quelles que soient leurs positions relatives.
            depthWrite: false,

            // Mélange normal, et non additif. Le mélange additif
            // ajoute de la lumière : sur un fond ivoire il sature
            // immédiatement en blanc et efface tout le texte
            // par-dessus. C'est exactement ce qui s'est produit au
            // premier essai. En normal, le verre fumé assombrit son
            // fond, ce qui est aussi le comportement physique.
            blending: THREE.NormalBlending,
        })
    );
    objet.add(coque);

    // --------------------------------------------------------
    // LE GRAPHE INTERNE
    // --------------------------------------------------------
    const posSphere = pointsSurSphere(NB_NOEUDS, 0.62);
    const posChaine = pointsEnChaine(NB_NOEUDS, 2.9);
    const aretes = relierVoisins(posSphere, VOISINS);

    // Position réellement affichée d'un nœud : le mélange entre sa
    // place sur la sphère et sa place dans la chaîne. Recalculée à
    // chaque image, elle sert aux nœuds comme aux arêtes.
    const posCourante = posSphere.map((p) => p.clone());

    // Les nœuds. Un InstancedMesh dessine les 48 octaèdres en un
    // seul appel à la carte graphique, au lieu de 48.
    const noeuds = new THREE.InstancedMesh(
        new THREE.OctahedronGeometry(petitEcran ? 0.030 : 0.023, 0),
        new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }),
        NB_NOEUDS
    );
    noeuds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    objet.add(noeuds);

    const matriceTemp = new THREE.Matrix4();
    const echelleTemp = new THREE.Vector3();
    const couleurTemp = new THREE.Color();

    const couleurEteint = couleurCss('--verre', styles);
    const couleurAllume = couleurCss('--graphe', styles);

    // Les arêtes du graphe : le maillage des plus proches voisins.
    const geoAretes = new THREE.BufferGeometry();
    geoAretes.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(aretes.length * 6), 3)
    );
    const lignesGraphe = new THREE.LineSegments(
        geoAretes,
        new THREE.LineBasicMaterial({ transparent: true, depthWrite: false })
    );
    objet.add(lignesGraphe);

    // Les arêtes de la chaîne : chaque nœud relié au suivant.
    // Elles remplacent les précédentes en fondu croisé quand le
    // graphe s'aligne, sinon le maillage sphérique s'étirerait en
    // tous sens et deviendrait illisible.
    const geoChaine = new THREE.BufferGeometry();
    geoChaine.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array((NB_NOEUDS - 1) * 6), 3)
    );
    const lignesChaine = new THREE.LineSegments(
        geoChaine,
        new THREE.LineBasicMaterial({ transparent: true, depthWrite: false })
    );
    objet.add(lignesChaine);

    /** Recharge toutes les couleurs depuis le CSS. Appelée au
     *  changement de thème : le JavaScript ne connaît aucune
     *  couleur en dur. */
    function relireCouleurs() {
        const s = getComputedStyle(document.documentElement);
        uniformes.uVerre.value = couleurCss('--verre', s);
        uniformes.uIrisA.value = couleurCss('--iris-a', s);
        uniformes.uIrisB.value = couleurCss('--iris-b', s);
        couleurEteint.copy(couleurCss('--verre', s));
        couleurAllume.copy(couleurCss('--graphe', s));
        lignesGraphe.material.color.copy(couleurAllume);
        lignesChaine.material.color.copy(couleurAllume);
    }
    relireCouleurs();

    // --------------------------------------------------------
    // ÉTAT ANIMÉ
    // --------------------------------------------------------
    // `cible` est calculé à partir du scroll, `actuel` le rejoint
    // avec de l'inertie. C'est cet écart qui donne son poids à
    // l'objet : il ne se colle jamais image par image au scroll.
    const cible  = poseInterpolee(0);
    const actuel = poseInterpolee(0);

    // Réaction à la souris : un décalage d'orientation très faible,
    // en plus de celui du scroll. Exprimé en fraction d'écran.
    const souris = { x: 0, y: 0, cx: 0, cy: 0 };

    function surSouris(evenement) {
        souris.x = (evenement.clientX / window.innerWidth) * 2 - 1;
        souris.y = (evenement.clientY / window.innerHeight) * 2 - 1;
    }

    if (!mouvementReduit && !petitEcran) {
        window.addEventListener('mousemove', surSouris, { passive: true });
    }

    /* --------------------------------------------------------
       MISE À JOUR D'UNE IMAGE
       -------------------------------------------------------- */
    function mettreAJour(delta, temps) {
        // 1. L'état courant rejoint l'état visé, avec inertie.
        //    La caméra est plus lente que l'objet : elle traîne
        //    légèrement, ce qui accentue la sensation de masse.
        const v = mouvementReduit ? 1e6 : 3.2;

        for (let i = 0; i < 3; i++) {
            actuel.camera[i]   = amortir(actuel.camera[i],   cible.camera[i],   v * 0.7, delta);
            actuel.regard[i]   = amortir(actuel.regard[i],   cible.regard[i],   v * 0.7, delta);
            actuel.rotation[i] = amortir(actuel.rotation[i], cible.rotation[i], v,       delta);
        }

        actuel.ouverture = amortir(actuel.ouverture, cible.ouverture, v, delta);
        actuel.graphe    = amortir(actuel.graphe,    cible.graphe,    v, delta);
        actuel.eveil     = amortir(actuel.eveil,     cible.eveil,     v, delta);
        actuel.chaine    = amortir(actuel.chaine,    cible.chaine,    v * 0.8, delta);

        souris.cx = amortir(souris.cx, souris.x, 2.2, delta);
        souris.cy = amortir(souris.cy, souris.y, 2.2, delta);

        // 2. Caméra et orientation.
        //
        // CADRAGE SELON LA FORME DE L'ÉCRAN
        // Les poses sont réglées pour un écran large : l'objet est
        // volontairement décalé sur le côté pour laisser la colonne
        // de texte respirer. Sur un écran étroit, ce décalage sort
        // l'objet du cadre et il apparaît tronqué au bord.
        //
        // On annule donc progressivement le décalage, et on recule
        // la caméra, à mesure que l'écran devient vertical.
        // aspect 1.6 et plus : réglage d'origine. aspect 0.7 et
        // moins (un téléphone tenu droit) : objet centré et plus
        // loin.
        const forme = Math.min(1, Math.max(0, (camera.aspect - 0.7) / 0.9));
        const recul = 1 + (1 - forme) * 0.8;

        camera.position.set(
            actuel.camera[0] * forme,
            actuel.camera[1],
            actuel.camera[2] * recul
        );
        camera.lookAt(
            actuel.regard[0] * forme,
            actuel.regard[1],
            actuel.regard[2]
        );

        // Les rotations sont exprimées en tours pour rester
        // lisibles dans le tableau des poses : on les convertit
        // ici en radians. Le décalage souris est volontairement
        // minuscule — c'est un frémissement, pas un pilotage.
        objet.rotation.set(
            actuel.rotation[0] * Math.PI * 2 + souris.cy * 0.06,
            actuel.rotation[1] * Math.PI * 2 + souris.cx * 0.10,
            actuel.rotation[2] * Math.PI * 2
        );

        // 3. Uniformes de la coque.
        uniformes.uOuverture.value = actuel.ouverture;
        uniformes.uTemps.value = temps;

        // La coque s'efface à mesure qu'elle s'ouvre : une fois
        // éclatée, ce qui compte c'est le graphe à l'intérieur — et
        // surtout le texte des sections, qui passe devant elle.
        // Ouverte, ses facettes sont vues de biais, donc en plein
        // fresnel : sans cet effacement elles formeraient un éclat
        // blanc derrière le contenu.
        uniformes.uOpacite.value = 1 - actuel.ouverture * 0.80;

        // 4. Position de chaque nœud, puis son éveil.
        for (let i = 0; i < NB_NOEUDS; i++) {
            posCourante[i].lerpVectors(posSphere[i], posChaine[i], actuel.chaine);

            // Les nœuds s'allument les uns après les autres plutôt
            // que tous ensemble : le front d'éveil balaie la liste.
            // Le +1.6 étale l'allumage d'un nœud sur un peu plus
            // d'un cran, pour que la vague ait une épaisseur.
            const front = actuel.eveil * (NB_NOEUDS + 6);
            const allume = Math.max(0, Math.min(1, (front - i) / 1.6));

            const taille = 0.55 + allume * 0.75;
            echelleTemp.setScalar(taille);
            matriceTemp.makeScale(echelleTemp.x, echelleTemp.y, echelleTemp.z);
            matriceTemp.setPosition(posCourante[i]);
            noeuds.setMatrixAt(i, matriceTemp);

            couleurTemp.copy(couleurEteint).lerp(couleurAllume, allume);
            noeuds.setColorAt(i, couleurTemp);
        }

        noeuds.instanceMatrix.needsUpdate = true;
        if (noeuds.instanceColor) noeuds.instanceColor.needsUpdate = true;
        noeuds.material.opacity = actuel.graphe;

        // 5. Les arêtes suivent les nœuds qu'elles relient.
        const tableauAretes = geoAretes.attributes.position.array;
        aretes.forEach(([a, b], i) => {
            tableauAretes[i * 6]     = posCourante[a].x;
            tableauAretes[i * 6 + 1] = posCourante[a].y;
            tableauAretes[i * 6 + 2] = posCourante[a].z;
            tableauAretes[i * 6 + 3] = posCourante[b].x;
            tableauAretes[i * 6 + 4] = posCourante[b].y;
            tableauAretes[i * 6 + 5] = posCourante[b].z;
        });
        geoAretes.attributes.position.needsUpdate = true;

        const tableauChaine = geoChaine.attributes.position.array;
        for (let i = 0; i < NB_NOEUDS - 1; i++) {
            tableauChaine[i * 6]     = posCourante[i].x;
            tableauChaine[i * 6 + 1] = posCourante[i].y;
            tableauChaine[i * 6 + 2] = posCourante[i].z;
            tableauChaine[i * 6 + 3] = posCourante[i + 1].x;
            tableauChaine[i * 6 + 4] = posCourante[i + 1].y;
            tableauChaine[i * 6 + 5] = posCourante[i + 1].z;
        }
        geoChaine.attributes.position.needsUpdate = true;

        // Fondu croisé entre les deux jeux d'arêtes.
        lignesGraphe.material.opacity = actuel.graphe * 0.62 * (1 - actuel.chaine);
        lignesChaine.material.opacity = actuel.graphe * 0.78 * actuel.chaine;

        rendu.render(scene, camera);
    }

    /* --------------------------------------------------------
       BOUCLE DE RENDU
       --------------------------------------------------------
       Elle s'arrête dès que l'onglet passe en arrière-plan : une
       page qu'on ne regarde pas n'a aucune raison de faire
       tourner la carte graphique.

       En mouvement réduit, on ne lance aucune boucle : une seule
       image est rendue à chaque changement de progression, et
       l'objet reste figé le reste du temps.
       -------------------------------------------------------- */
    let identifiantBoucle = null;
    let dernierInstant = performance.now();
    let enPause = false;

    function boucle(instant) {
        identifiantBoucle = requestAnimationFrame(boucle);

        // Delta plafonné : au retour d'un onglet resté en
        // arrière-plan, l'écart peut valoir plusieurs secondes et
        // ferait bondir l'objet d'un coup.
        const delta = Math.min((instant - dernierInstant) / 1000, 0.05);
        dernierInstant = instant;

        mettreAJour(delta, instant / 1000);
    }

    function demarrer() {
        if (mouvementReduit || identifiantBoucle !== null) return;
        dernierInstant = performance.now();
        identifiantBoucle = requestAnimationFrame(boucle);
    }

    function arreter() {
        if (identifiantBoucle === null) return;
        cancelAnimationFrame(identifiantBoucle);
        identifiantBoucle = null;
    }

    document.addEventListener('visibilitychange', () => {
        enPause = document.hidden;
        if (enPause) arreter();
        else demarrer();
    });

    /* --------------------------------------------------------
       REDIMENSIONNEMENT
       --------------------------------------------------------
       Un redimensionnement force le navigateur à réallouer les
       tampons de la carte graphique : on attend que l'utilisateur
       ait fini de bouger la fenêtre avant de le faire.
       -------------------------------------------------------- */
    let minuteurTaille = null;

    function surRedimensionnement() {
        clearTimeout(minuteurTaille);
        minuteurTaille = setTimeout(() => {
            const l = conteneur.clientWidth;
            const h = conteneur.clientHeight;
            if (!l || !h) return;

            camera.aspect = l / h;
            camera.updateProjectionMatrix();
            rendu.setPixelRatio(Math.min(window.devicePixelRatio, DPR_MAX));
            rendu.setSize(l, h);

            if (mouvementReduit) mettreAJour(0, 0);
        }, 180);
    }

    window.addEventListener('resize', surRedimensionnement, { passive: true });

    // Première image, puis on laisse le CSS faire apparaître le
    // canvas en fondu.
    mettreAJour(0, 0);
    conteneur.classList.add('est-prete');
    demarrer();

    /* --------------------------------------------------------
       INTERFACE PUBLIQUE
       -------------------------------------------------------- */
    return {
        /** Appelée par scroll.js à chaque changement de position. */
        setProgression(p) {
            Object.assign(cible, poseInterpolee(p));

            // En mouvement réduit il n'y a pas de boucle : on rend
            // une image à la demande, sans inertie.
            if (mouvementReduit && !enPause) mettreAJour(1, 0);
        },

        /** Appelée par interface.js au changement de thème. */
        relireCouleurs,
    };
}
