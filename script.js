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
// Variables para el movimiento de la cámara
let focusedPlanet = null; // Almacena el planeta actualmente enfocado, o null
let previousCameraPosition = new THREE.Vector3(); // Para guardar la posición de la cámara antes de enfocar
let previousCameraTarget = new THREE.Vector3();   // Para guardar el target de OrbitControls
const cameraOffset = new THREE.Vector3(4, 10, 20); // Desplazamiento de la cámara relativo al planeta
let isCameraFocused = false; // para saber si la cámara está enfocada en un planeta
// Variables para el audio
let audioListener, backgroundMusic;
let musicVolume = 0.5; // Volumen inicial, debe coincidir con el slider
let isMusicPlaying = false; // Estado de la música

// movimiento de la cámara
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onDocumentMouseDown(event) {
    event.preventDefault();
    // Calcula la posición del mouse en coordenadas normalizadas del dispositivo (-1 a +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    // Actualiza el raycaster con la cámara y la posición del mouse
    raycaster.setFromCamera(mouse, camera);
    // Calcula los objetos que intersectan el rayo. Solo nos interesan los meshes de los planetas
    const planetMeshes = planets.map(p => p.mesh);
    const intersects = raycaster.intersectObjects(planetMeshes);

    if (intersects.length > 0) {
        // Hubo un clic en un planeta
        const clickedObject = intersects[0].object; // El primer objeto intersectado es el más cercano
        // Buscar el objeto planeta correspondiente al mesh clickeado
        const targetPlanet = planets.find(p => p.mesh === clickedObject);
        if (targetPlanet) {
            if (focusedPlanet === targetPlanet) { // Si ya estaba enfocado en este planeta, desenfocar
                unfocusCamera();
            } else {
                focusOnPlanet(targetPlanet);
            }
        }
    } else {
        // Hubo un clic fuera de cualquier planeta
        if (isCameraFocused) {
            unfocusCamera();
        }
    }
}

// Añadir el event listener en init()
// window.addEventListener('mousedown', onDocumentMouseDown, false); // O 'click'
window.addEventListener('pointerdown', onDocumentMouseDown, false);

// Cambio del estado de la cámara
function focusOnPlanet(planet) {
    focusedPlanet = planet;
    isCameraFocused = true;    
    controls.enabled = false; // Deshabilitar OrbitControls para que no interfiera con el seguimiento
    // Guardar la posición y el objetivo actuales de la cámara/controles
    // para poder restaurarlos después.
    previousCameraPosition.copy(camera.position);
    previousCameraTarget.copy(controls.target); // Guardar el punto donde miraban los OrbitControls
    // para que se actualice en cada frame mientras sigue al planeta.
    console.log("Enfocando en:", planet.name);
}

function unfocusCamera() {
    if (!isCameraFocused) return; // Ya está desenfocada
    focusedPlanet = null;
    isCameraFocused = false;    
    controls.enabled = true; // Restaurar OrbitControls
    // Restaurar la posición de la cámara y el objetivo de OrbitControls.
    // Para una transición suave aquí se puede usar GSAP o TWEEN.js
    camera.position.copy(previousCameraPosition);
    controls.target.copy(previousCameraTarget);
    controls.update(); // Para que OrbitControls tome los nuevos valores
    console.log("Cámara desenfocada, control del usuario restaurado.");
}


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

    // 1. Crear AudioListener y añadirlo a la cámara
    audioListener = new THREE.AudioListener();
    camera.add(audioListener); // El listener "escucha" desde la posición de la cámara

    // 2. Crear el objeto Audio para la música de fondo
    backgroundMusic = new THREE.Audio(audioListener);

    // 3. Cargar el archivo de audio
    const audioLoader = new THREE.AudioLoader(loadingManager); // loadingManager existente
    audioLoader.load(
        'sound.mp3', // Ruta 
        function(buffer) {
            // Callback cuando el audio se carga exitosamente
            backgroundMusic.setBuffer(buffer);
            backgroundMusic.setLoop(true); // Para que se reproduzca en bucle
            backgroundMusic.setVolume(musicVolume); // Establecer volumen inicial
            console.log("Música de fondo cargada.");
            // No reproducir automáticamente aquí debido a las políticas del navegador.
            // Se reproducirá al hacer clic en el botón.
        },
        function(xhr) {
            // Callback de progreso (opcional)
            console.log((xhr.loaded / xhr.total * 100) + '% cargado de música');
        },
        function(err) {
            // Callback de error
            console.error('Error al cargar la música de fondo:', err);
        }
    );

    
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
        console.log("Control de velocidad en funcionamiento");
        timeScale = parseFloat(event.target.value);
        speedValueDisplay.textContent = `${timeScale.toFixed(1)}x`;
    });
    speedSlider.addEventListener('pointerdown', function(event) { 
        event.stopPropagation();
    });

    // Control de Escala de Planetas
    const scaleSlider = document.getElementById('scale-slider');
    const scaleValueDisplay = document.getElementById('scale-value');
    scaleSlider.value = planetScaleMultiplier; // Sincronizar slider con valor inicial
    scaleValueDisplay.textContent = `${planetScaleMultiplier.toFixed(0)}x`; // Usar toFixed(0) para enteros
    scaleSlider.addEventListener('input', (event) => {
        console.log("Control de escala funcionando");
        planetScaleMultiplier = parseFloat(event.target.value);
        scaleValueDisplay.textContent = `${planetScaleMultiplier.toFixed(0)}x`;
        updatePlanetScales(); // Llamar a la función que actualiza las escalas
    });
    scaleSlider.addEventListener('pointerdown', function(event){
        event.stopPropagation();
    })

    // Control de Volumen de Música
    const volumeSlider = document.getElementById('volume-slider');
    const volumeValueDisplay = document.getElementById('volume-value');
    const playPauseButton = document.getElementById('play-pause-button');

    volumeSlider.value = musicVolume; // Sincronizar slider
    volumeValueDisplay.textContent = `${Math.round(musicVolume * 100)}%`;

    volumeSlider.addEventListener('input', (event) => {
        console.log("Control de volumen funcionando");
        musicVolume = parseFloat(event.target.value);
        volumeValueDisplay.textContent = `${Math.round(musicVolume * 100)}%`;
        if (backgroundMusic) {
            backgroundMusic.setVolume(musicVolume);
        }
    });
    volumeSlider.addEventListener('pointerdown', function(event) { 
        event.stopPropagation();
    });

    playPauseButton.addEventListener('click', () => {
        if (!backgroundMusic || !backgroundMusic.buffer) {
            console.log("La música aún no está cargada o hubo un error.");
            return;
        }

        if (isMusicPlaying) {
            backgroundMusic.pause();
            playPauseButton.textContent = 'Reproducir';
        } else {
            // Intentar reproducir. El navegador puede bloquearlo si no hay interacción previa.
            // El AudioContext a menudo necesita ser "desbloqueado" por una acción del usuario.
            if (audioListener.context.state === 'suspended') {
                audioListener.context.resume();
            }
            backgroundMusic.play();
            playPauseButton.textContent = 'Pausar';
        }
        isMusicPlaying = !isMusicPlaying;
    });
    playPauseButton.addEventListener('pointerdown', function(event) { 
        event.stopPropagation();
    });
}

// Actualizar las escalas de los planetas
function updatePlanetScales() {
    planets.forEach(planet => {
        const baseRadius = planet.mesh.userData.baseRadius;
        const newScale = baseRadius * planetScaleMultiplier;
        planet.mesh.scale.set(newScale, newScale, newScale);
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
    if (controls.enabled) controls.update();

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

    sun.rotation.y += 0.001 * timeScale * delta * 60;

    if (isCameraFocused && focusedPlanet) {

        const planetWorldPosition = new THREE.Vector3();
        focusedPlanet.mesh.getWorldPosition(planetWorldPosition);

        const sunWorldPosition = new THREE.Vector3();
        sun.getWorldPosition(sunWorldPosition);

        // 1. Calcular la dirección del Sol al Planeta
        const dirSunToPlanet = new THREE.Vector3().subVectors(planetWorldPosition, sunWorldPosition).normalize();

        // Posición base: la del planeta
        let desiredCameraPosition = planetWorldPosition.clone();

        // Añadir el offset "detrás" del planeta (en la dirección opuesta a la que va del planeta al sol)        
        desiredCameraPosition.addScaledVector(dirSunToPlanet, cameraOffset.z); 
        // Añadir el offset de altura en el eje Y
        desiredCameraPosition.y += cameraOffset.y;

        // Añadir un offset lateral
        // Para un offset lateral simple, podemos calcular un vector "derecha"
        if (cameraOffset.x !== 0) {
            const upVector = new THREE.Vector3(0, 1, 0); // Asumimos Y como arriba global
            const lateralOffsetVector = new THREE.Vector3().crossVectors(dirSunToPlanet, upVector).normalize();
            desiredCameraPosition.addScaledVector(lateralOffsetVector, cameraOffset.x);
        }

        // Interpolar suavemente la posición de la cámara
        camera.position.lerp(desiredCameraPosition, 0.1);

        // Hacer que la cámara mire al Sol (esto ya lo tenías y es correcto para el objetivo)
        camera.lookAt(sunWorldPosition);
    } 

    renderer.render(scene, camera);
    
}


// LLAMADAS PARA INICIAR
init(); // 