import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, controls;
let sun, planets = [];
let timeScale = 1.0;
const clock = new THREE.Clock();
const sunRadius = 3;
const earthSunProportion = 0.00915768;
const UA = 10;
let planetScaleMultiplier = 10;

// Velocidades orbitales son relativas y aproximadas
const planetData = [
    { name: 'Mercury', radius: 0.38*earthSunProportion, distance: 1*UA, 
        speed: 1.6, texture: 'textures/mercury.jpg', color: 0xaaaaaa },
    { name: 'Venus', radius: 0.95*earthSunProportion, distance: 1.5*UA, 
        speed: 1.17, texture: 'textures/venus.jpg', color: 0xffe0b2 },
    { name: 'Earth', radius: 1*earthSunProportion, distance: 2*UA, 
        speed: 1, texture: 'textures/earth.jpg', color: 0x6699ff },
    { name: 'Mars', radius: 0.53*earthSunProportion, distance: 2.52*UA, 
        speed: 0.8, texture: 'textures/mars.jpg', color: 0xff7f50 },
    { name: 'Jupiter', radius: 11.2*earthSunProportion, distance: 3*UA, 
        speed: 0.43, texture: 'textures/jupiter.jpg', color: 0xffd700 },
    { name: 'Saturn', radius: 9.45*earthSunProportion, distance: 4*UA, 
        speed: 0.32, texture: 'textures/saturn.jpg', ringTexture: 'textures/saturn_ring.png', color: 0xf0e68c },
    { name: 'Uranus', radius: 4*earthSunProportion, distance: 5.22*UA, 
        speed: 0.22, texture: 'textures/uranus.jpg', color: 0xadd8e6 },
    { name: 'Neptune', radius: 3.88*earthSunProportion, distance: 7.06*UA, 
        speed: 0.18, texture: 'textures/neptune.jpg', color: 0x4169e1 }
];

// Para cargar texturas
const textureLoader = new THREE.TextureLoader();
const loadingManager = new THREE.LoadingManager();
const loadingScreen = document.getElementById('loading-screen');

loadingManager.onStart = function ( url, itemsLoaded, itemsTotal ) {
    console.log( 'Started loading file: ' + url + '.\nLoaded ' + itemsLoaded + ' of ' + itemsTotal + ' files.' );
    loadingScreen.style.display = 'flex'; 
};

loadingManager.onLoad = function ( ) {
    console.log( 'Loading complete!');
    loadingScreen.style.display = 'none'; // Oculta la pantalla de carga
    animate(); // Inicia el bucle de animación DESPUÉS de que todo esté cargado
};

loadingManager.onError = function ( url ) {
    console.log( 'Hubo un error al cargar ' + url );
    loadingScreen.textContent = 'Error al cargar texturas';
};

textureLoader.manager = loadingManager; // ASIGNAR EL MANAGER AL LOADER

function init() {
    // Escena
    scene = new THREE.Scene();

    // Cámara
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(0, 30, 60); // Posición inicial de la cámara

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true; // Habilitar sombras
    document.body.appendChild(renderer.domElement);
    renderer.outputColorSpace = THREE.SRGBColorSpace;   
    
    // Controles de órbita (zoom, pan, rotate)
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // Movimiento suave
    controls.dampingFactor = 0.05;
    controls.minDistance = 4;
    controls.maxDistance = 1000;

    // Luz ambiental
    const ambientLight = new THREE.AmbientLight(0x808080, 6); // luz suave
    scene.add(ambientLight);

    // Sol (fuente de luz puntual)    
    const sunGeometry = new THREE.SphereGeometry(sunRadius, 64, 64); // Radio del Sol
    const sunTexture = textureLoader.load('textures/sun.jpg');
    sunTexture.colorSpace = THREE.SRGBColorSpace;
    const sunMaterial = new THREE.MeshBasicMaterial({ map: sunTexture, emissive: 0xffff00, emissiveIntensity: 1 }); // El sol emite luz
    sun = new THREE.Mesh(sunGeometry, sunMaterial);
    sun.castShadow = false; // El sol no arroja sombras sobre sí mismo
    scene.add(sun);

    const pointLight = new THREE.PointLight(0xffffff, 10, 1000); // Luz blanca, intensidad, distancia
    pointLight.position.set(0, 0, 0); // Posicionada en el sol
    pointLight.castShadow = true;
    // Configuración de sombras para la luz puntual (opcional, puede impactar rendimiento)
    pointLight.shadow.mapSize.width = 4096;
    pointLight.shadow.mapSize.height = 4096;
    scene.add(pointLight);
    
    const flareTexture = textureLoader.load('textures/sun_flare.jpg');
    const flareMaterial = new THREE.SpriteMaterial({
        map: flareTexture,
        color: 0xffddaa, // Tinte anaranjado/amarillo para el brillo
        transparent: true,
        blending: THREE.AdditiveBlending, // Hace que los colores se sumen
        depthWrite: false, // Para que no interfiera con la profundidad de otros objetos
        opacity: 0.4 // Ajusta la opacidad
    });

    const sunGlow = new THREE.Sprite(flareMaterial);
    sunGlow.scale.set(10, 10, 0.2); 
    sun.add(sunGlow); // como hijo del sol para que se mueva con él

    // Crear planetas
    planetData.forEach(data => {
        const planetGeometry = new THREE.SphereGeometry(1, 32, 32);
        const planetTexture = textureLoader.load(data.texture);
        planetTexture.colorSpace = THREE.SRGBColorSpace;
        // const planetMaterial = new THREE.MeshStandardMaterial({ map: planetTexture, roughness: 0.8, metalness: 0.1 });
        const planetMaterial = new THREE.MeshStandardMaterial({
            map: textureLoader.load(data.texture, (texture) => {
                texture.colorSpace = THREE.SRGBColorSpace;
            }),
            roughness: 0.6, // Ajustado un poco
            metalness: 0.1
        });
        
        const planetMesh = new THREE.Mesh(planetGeometry, planetMaterial);
        planetMesh.castShadow = true;
        planetMesh.receiveShadow = true;

        // Almacenar el radio base del planeta (el que está en planetData)
        // para poder recalcular la escala correctamente.
        planetMesh.userData.baseRadius = data.radius; // Guardamos el radio original aquí

        // Aplicar la escala inicial
        planetMesh.scale.set(
            data.radius * planetScaleMultiplier,
            data.radius * planetScaleMultiplier,
            data.radius * planetScaleMultiplier
        );

        // Objeto pivote para la órbita (así el planeta rota sobre sí mismo independientemente de la órbita)
        const orbitPivot = new THREE.Object3D();
        orbitPivot.add(planetMesh);
        scene.add(orbitPivot);

        // Posicionar planeta en su órbita inicial
        // Usamos un ángulo aleatorio para que no empiecen todos alineados
        const initialAngle = Math.random() * Math.PI * 2;
        planetMesh.position.x = data.distance * Math.cos(initialAngle);
        planetMesh.position.z = data.distance * Math.sin(initialAngle);

        const planet = {
            name: data.name,
            mesh: planetMesh,
            orbitPivot: orbitPivot,
            distance: data.distance,
            speed: data.speed * 0.1, // Ajustar velocidad base
            angle: initialAngle, // Ángulo orbital actual
            rotationSpeed: 0.05 // Velocidad de rotación sobre su eje
        };

        // Anillos de Saturno
        if (data.name === 'Saturn' && data.ringTexture) {
            const ringTexture = textureLoader.load(data.ringTexture, (texture) => {
                texture.colorSpace = THREE.SRGBColorSpace; // Importante para la transparencia correcta también
            });
            // Los radios del anillo deben escalar con el planeta.
            // Se calculan basados en el radio actual del planeta (que ya está escalado).
            // O mejor, basarlos en el baseRadius y luego escalarlos.
            const ringInnerRadius = planetMesh.userData.baseRadius * 1.2;
            const ringOuterRadius = planetMesh.userData.baseRadius * 2.2;

            const ringGeometry = new THREE.RingGeometry(
                ringInnerRadius, // Radio interno base
                ringOuterRadius, // Radio externo base
                64
            );
            ringGeometry.rotateX(-Math.PI / 2);

            const ringMaterial = new THREE.MeshStandardMaterial({
                map: ringTexture,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.8,
                // No queremos que los anillos proyecten sombras sobre sí mismos o el planeta de forma extraña
                // castShadow: false, // Opcional
                receiveShadow: true
            });            
            const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);

            // Escalar los anillos igual que el planeta.
            // Como son hijos del planeta, si escalamos el planeta, los anillos escalan con él.
            // PERO, RingGeometry se define con radios absolutos.
            // Así que, si la geometría del anillo se define una vez,
            // y el planeta se escala, los anillos podrían necesitar un ajuste o ser hijos del planetMesh
            // y su tamaño base ya estar en proporción al tamaño base del planeta.
            // La forma más sencilla es hacerlos hijos del planetMesh y que su geometría
            // ya esté en proporción al radio NO MULTIPLICADO del planeta.
            // Luego, cuando planetMesh.scale se actualiza, los anillos escalan bien.
            planetMesh.add(ringMesh); // Añadir anillos como hijos del planeta
            planet.ringMesh = ringMesh;
        }
        
        planets.push(planet);

        // Opcional: Dibujar órbitas
        const orbitCurve = new THREE.EllipseCurve(
            0, 0,             // Centro x, y
            data.distance, data.distance, // radio x, radio y (círculo)
            0, 2 * Math.PI,   // Ángulo inicial, ángulo final
            false,            // Dirección horaria
            0                 // Rotación
        );
        const points = orbitCurve.getPoints(128);
        const orbitGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const orbitMaterial = new THREE.LineBasicMaterial({ color: 0x555555, transparent: true, opacity: 0.5 });
        const orbitLine = new THREE.LineLoop(orbitGeometry, orbitMaterial); // Usar LineLoop para cerrar el círculo
        orbitLine.rotation.x = Math.PI / 2; // Rotar para que esté en el plano XZ
        scene.add(orbitLine);
    });

    // Fondo de estrellas (Starfield)
    const starGeometry = new THREE.SphereGeometry(1000, 64, 64); // Esfera muy grande
    const starTexture = textureLoader.load('textures/stars.jpg');
    // starTexture.colorSpace = THREE.SRGBColorSpace;
    const starMaterial = new THREE.MeshBasicMaterial({
        map: starTexture,
        side: THREE.BackSide // Renderizar el interior de la esfera
    });
    const starField = new THREE.Mesh(starGeometry, starMaterial);
    scene.add(starField);

    // Manejador de redimensionamiento de ventana
    window.addEventListener('resize', onWindowResize, false);

    // Control de velocidad
    const speedSlider = document.getElementById('speed-slider');
    const speedValueDisplay = document.getElementById('speed-value');
    speedSlider.value = timeScale; // Sincronizar slider con valor inicial
    speedValueDisplay.textContent = `${timeScale.toFixed(1)}x`;
    speedSlider.addEventListener('input', (event) => {
        timeScale = parseFloat(event.target.value);
        speedValueDisplay.textContent = `${timeScale.toFixed(1)}x`;
    });

    // Control de Escala de Planetas
    const scaleSlider = document.getElementById('scale-slider');
    const scaleValueDisplay = document.getElementById('scale-value');
    scaleSlider.value = planetScaleMultiplier; // Sincronizar slider con valor inicial
    scaleValueDisplay.textContent = `${planetScaleMultiplier.toFixed(0)}x`; // Usar toFixed(0) para enteros
    scaleSlider.addEventListener('input', (event) => {
        planetScaleMultiplier = parseFloat(event.target.value);
        scaleValueDisplay.textContent = `${planetScaleMultiplier.toFixed(0)}x`;
        updatePlanetScales(); // Llamar a la función que actualiza las escalas
    });
}

// Nueva función para actualizar las escalas de los planetas
function updatePlanetScales() {
    planets.forEach(planet => {
        const baseRadius = planet.mesh.userData.baseRadius;
        const newScale = baseRadius * planetScaleMultiplier;
        planet.mesh.scale.set(newScale, newScale, newScale);

        // Si los anillos de Saturno no escalan automáticamente como hijos,
        // necesitarías re-escalarlos aquí también, o reconstruir su geometría
        // si sus radios se definieron absolutamente.
        // Pero como los hicimos hijos del planetMesh y sus geometrías son relativas al radio base,
        // el escalado del planetMesh debería encargarse de los anillos.
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    
}

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta(); // Tiempo transcurrido desde el último frame

    // Actualizar controles de órbita
    controls.update();

    // Rotación del Sol sobre sí mismo (lento)
    sun.rotation.y += 0.001 * timeScale * delta * 60; // el delta * 60 es para normalizar si delta es pequeño

    // Movimiento y rotación de planetas
    planets.forEach(planet => {
        // Rotación orbital
        planet.angle += planet.speed * timeScale * delta;
        planet.orbitPivot.position.set(0,0,0); // Asegurar que el pivote está en el sol
        // Actualizar la posición del planeta en su órbita
        // No necesitamos rotar el pivot, sino actualizar la posición del mesh del planeta
        // respecto a su pivot, que está en el sol.
        planet.mesh.position.x = planet.distance * Math.cos(planet.angle);
        planet.mesh.position.z = planet.distance * Math.sin(planet.angle);

        // Rotación del planeta sobre su propio eje
        planet.mesh.rotation.y += planet.rotationSpeed * timeScale * delta * 60;

        // Si Saturno tiene anillos, que roten con el planeta (ya son hijos, así que esto es automático)
        // Podrías añadir una rotación diferencial si quisieras.
    });

    renderer.render(scene, camera);
    
}


// LLAMADAS PARA INICIAR
init(); // ¡Llama a init() aquí para que comience la carga de texturas y la configuración de la escena!

// El manejador de redimensionamiento y el control de velocidad ya están dentro de init o son globales.
